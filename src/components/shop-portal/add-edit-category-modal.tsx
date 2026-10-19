"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { MenuCategory } from "./types";
import { X, Layers, AlertCircle, RefreshCw } from "lucide-react";

interface AddEditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  categoryToEdit?: MenuCategory | null;
  onSuccess: () => void;
}

interface CategoryFormProps {
  shopId: string;
  categoryToEdit?: MenuCategory | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryForm({
  shopId,
  categoryToEdit,
  onClose,
  onSuccess,
}: CategoryFormProps) {
  const isEditing = Boolean(categoryToEdit);

  const [name, setName] = React.useState(categoryToEdit?.name || "");
  const [slug, setSlug] = React.useState(categoryToEdit?.slug || "");
  const [sortOrder, setSortOrder] = React.useState<number>(categoryToEdit?.sortOrder ?? 0);
  const [isAvailable, setIsAvailable] = React.useState<boolean>(categoryToEdit?.isAvailable ?? true);
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(isEditing);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-slugify helper if slug wasn't manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited && !isEditing) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Category slug is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/shops/${shopId}/categories/${categoryToEdit!.id}`
        : `/api/shops/${shopId}/categories`;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          sortOrder: Number(sortOrder) || 0,
          isAvailable,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error?.message || "Failed to save category");
      }
    } catch {
      setError("Network error while saving category");
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
            <Layers className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isEditing ? "Edit Category" : "Add New Category"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditing ? "Update category information" : "Create a new product category"}
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
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Category Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Burgers, Beverages, Desserts"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Slug (URL Identifier) <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            placeholder="e.g. burgers"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Unique per shop. Use lowercase letters, numbers, and hyphens.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lower appears first
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Availability
            </label>
            <div className="pt-1.5 flex items-center gap-2">
              <input
                type="checkbox"
                id="category-available-toggle"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <label
                htmlFor="category-available-toggle"
                className="text-xs text-foreground cursor-pointer select-none"
              >
                {isAvailable ? "Active (Visible)" : "Inactive (Hidden)"}
              </label>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AddEditCategoryModal({
  isOpen,
  onClose,
  shopId,
  categoryToEdit,
  onSuccess,
}: AddEditCategoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all">
        <CategoryForm
          key={categoryToEdit ? categoryToEdit.id : "new"}
          shopId={shopId}
          categoryToEdit={categoryToEdit}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
}
