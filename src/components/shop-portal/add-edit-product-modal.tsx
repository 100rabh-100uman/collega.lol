"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { MenuCategory, MenuProduct } from "./types";
import {
  X,
  UtensilsCrossed,
  AlertCircle,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
} from "lucide-react";

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  categories: MenuCategory[];
  productToEdit?: MenuProduct | null;
  defaultCategoryId?: string;
  onSuccess: () => void;
}

interface ProductFormProps {
  shopId: string;
  categories: MenuCategory[];
  productToEdit?: MenuProduct | null;
  defaultCategoryId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ProductForm({
  shopId,
  categories,
  productToEdit,
  defaultCategoryId,
  onClose,
  onSuccess,
}: ProductFormProps) {
  const isEditing = Boolean(productToEdit);

  const [name, setName] = React.useState(productToEdit?.name || "");
  const [description, setDescription] = React.useState(productToEdit?.description || "");
  const [price, setPrice] = React.useState<string>(
    productToEdit ? String(productToEdit.price) : ""
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    productToEdit?.categoryId || defaultCategoryId || (categories[0]?.id ?? "")
  );
  const [imageUrl, setImageUrl] = React.useState<string>(productToEdit?.imageUrl || "");
  const [preparationTimeMins, setPreparationTimeMins] = React.useState<string>(
    productToEdit?.preparationTimeMins ? String(productToEdit.preparationTimeMins) : ""
  );
  const [sortOrder, setSortOrder] = React.useState<number>(productToEdit?.sortOrder ?? 0);
  const [isAvailable, setIsAvailable] = React.useState<boolean>(
    productToEdit?.isAvailable ?? true
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle image upload to Supabase Storage
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must not exceed 5MB");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file format. Allowed formats: JPEG, PNG, WebP, GIF");
      return;
    }

    setIsUploadingImage(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/shops/${shopId}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.data?.url) {
        setImageUrl(data.data.url);
        setUploadSuccess(true);
      } else {
        setError(data.error?.message || "Failed to upload image");
      }
    } catch {
      setError("Network error while uploading image");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    if (!categoryId) {
      setError("Please select a category");
      return;
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      setError("Please enter a valid positive price in INR (e.g. 150.00)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/shops/${shopId}/products/${productToEdit!.id}`
        : `/api/shops/${shopId}/products`;
      const method = isEditing ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        price: parseFloat(price).toFixed(2),
        categoryId,
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
        isAvailable,
        sortOrder: Number(sortOrder) || 0,
        preparationTimeMins: preparationTimeMins ? parseInt(preparationTimeMins, 10) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error?.message || "Failed to save product");
      }
    } catch {
      setError("Network error while saving product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <UtensilsCrossed className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isEditing ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditing ? "Update product item details" : "Add an item to the menu catalog"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Product Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Classic Paneer Burger"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Category <span className="text-destructive">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Price (INR) <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-muted-foreground font-semibold">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150.00"
                className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Crisp cottage cheese patty with fresh lettuce, mayo, and spicy sauce..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Image Upload & Preview */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Product Image
          </label>
          <div className="mt-1 flex items-center gap-4">
            {/* Image Preview Box */}
            <div className="relative size-20 rounded-xl border border-border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
              {imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-destructive hover:bg-background"
                    title="Remove image"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </>
              ) : (
                <ImageIcon className="size-8 text-muted-foreground/40" />
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-1.5">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
                id="product-image-upload"
              />
              <label htmlFor="product-image-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  {isUploadingImage ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {isUploadingImage
                    ? "Uploading..."
                    : imageUrl
                    ? "Replace Image"
                    : "Upload Image"}
                </Button>
              </label>
              {uploadSuccess && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-3" /> Uploaded to Supabase
                </span>
              )}
              <p className="text-[11px] text-muted-foreground">
                PNG, JPG, WebP or GIF up to 5MB. Stored securely.
              </p>
            </div>
          </div>
        </div>

        {/* Preparation Time & Ordering */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Prep Time (Minutes)
            </label>
            <input
              type="number"
              min={1}
              value={preparationTimeMins}
              onChange={(e) => setPreparationTimeMins(e.target.value)}
              placeholder="e.g. 15"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Display Order
            </label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Availability Switch */}
        <div className="pt-2 flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3">
          <div>
            <div className="text-xs font-semibold text-foreground">Product Availability</div>
            <p className="text-[11px] text-muted-foreground">
              When unavailable, students cannot add this item to their cart
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="product-available-toggle"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
            <label
              htmlFor="product-available-toggle"
              className="text-xs font-medium text-foreground cursor-pointer select-none"
            >
              {isAvailable ? "Available" : "Unavailable"}
            </label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting || isUploadingImage}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || isUploadingImage}
            className="gap-1.5"
          >
            {isSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
            {isEditing ? "Save Changes" : "Add Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AddEditProductModal({
  isOpen,
  onClose,
  shopId,
  categories,
  productToEdit,
  defaultCategoryId,
  onSuccess,
}: AddEditProductModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl my-8 transition-all">
        <ProductForm
          key={productToEdit ? productToEdit.id : "new"}
          shopId={shopId}
          categories={categories}
          productToEdit={productToEdit}
          defaultCategoryId={defaultCategoryId}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
}
