const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const supabase = require("../supabaseClient");
const { releaseExpiredReservations } = require("../services/orderService");

// Images stay in memory only long enough to upload to Supabase Storage.
// Files outside these formats and files larger than 5 MB are rejected.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(
      null,
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
    ),
});

// ---------------------------------------------------------------------------
// Catalog CRUD
// ---------------------------------------------------------------------------

// CREATE: Add a new product.
router.post("/", async (req, res) => {
  const { name, description, price, category, stock } = req.body;

  if (!name || price === undefined || !category) {
    return res
      .status(400)
      .json({ error: "Name, price, and category are required fields." });
  }

  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        name,
        description,
        price,
        category,
        stock: stock ?? 0,
      },
    ])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// READ ALL: Fetch products with search, category, and price filtering.
router.get("/", async (req, res) => {
  const { search, category, minPrice, maxPrice, includeInactive } = req.query;
  await releaseExpiredReservations();

  let query = supabase.from("products").select("*");

  // Customer and POS catalogs only show products that are available for sale.
  // Admin inventory can opt in to inactive products with ?includeInactive=true.
  if (includeInactive !== "true") {
    query = query.eq("is_active", true);
  }

  // Apply query filters sent from React frontend
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (minPrice) {
    query = query.gte("price", parseFloat(minPrice));
  }
  if (maxPrice) {
    query = query.lte("price", parseFloat(maxPrice));
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// READ ONE: Get a product by UUID.
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: "Product not found" });
  res.status(200).json(data);
});

// UPDATE: Modify only the fields supplied by the admin.
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, stock, is_active } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries({
    name,
    description,
    price,
    category,
    stock,
    is_active,
  })) {
    if (value !== undefined) updates[key] = value;
  }

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Product not found" });

  res.status(200).json(data);
});

// DELETE: Soft-delete instead of removing the database row. This preserves
// historical order_items and avoids foreign-key violations.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  if (!data || data.length === 0)
    return res.status(404).json({ error: "Product not found" });

  res.status(200).json({ message: "Product deactivated successfully" });
});

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------

// Upload an optional catalog image. The file lives in Supabase Storage;
// the products table stores its public URL and the path used for replacement.
router.post("/:id/image", upload.single("image"), async (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ error: "Upload a JPEG, PNG, or WebP image under 5 MB." });
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, image_path")
    .eq("id", req.params.id)
    .single();
  if (productError)
    return res.status(400).json({ error: productError.message });
  if (!product) return res.status(404).json({ error: "Product not found." });
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[req.file.mimetype];
  const imagePath = `products/${product.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(imagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  const { data: urlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(imagePath);
  const { data, error } = await supabase
    .from("products")
    .update({
      image_url: urlData.publicUrl,
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (product.image_path)
    await supabase.storage.from("product-images").remove([product.image_path]);
  res.json(data);
});

router.delete("/:id/image", async (req, res) => {
  // Remove the Storage object first, then clear its product metadata.
  const { data: product, error } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (product.image_path)
    await supabase.storage.from("product-images").remove([product.image_path]);
  const { data, error: updateError } = await supabase
    .from("products")
    .update({
      image_url: null,
      image_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (updateError) return res.status(400).json({ error: updateError.message });
  res.json(data);
});

module.exports = router;
