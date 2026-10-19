"use client";

import * as React from "react";
import Link from "next/link";
import { formatPriceINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { AddEditCategoryModal } from "./add-edit-category-modal";
import { AddEditProductModal } from "./add-edit-product-modal";
import type { AuthorizedShop, MenuCategory, MenuProduct } from "./types";
import {
  Plus,
  Edit2,
  Clock,
  Layers,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Search,
  Image as ImageIcon,
  Power,
} from "lucide-react";

interface ManageMenuViewProps {
  shop: AuthorizedShop;
}

export function ManageMenuView({ shop }: ManageMenuViewProps) {
  const [categories, setCategories] = React.useState<MenuCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [categoryToEdit, setCategoryToEdit] = React.useState<MenuCategory | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [productToEdit, setProductToEdit] = React.useState<MenuProduct | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = React.useState<string | undefined>(undefined);

  // Quick toggle tracking (product or category ID currently updating)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const fetchCategories = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shops/${shop.id}/categories`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.data || []);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load categories and menu items");
      }
    } catch {
      setError("Network error connecting to shop catalog API");
    } finally {
      setLoading(false);
    }
  }, [shop.id]);

  React.useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch(`/api/shops/${shop.id}/categories`);
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setCategories(data.data || []);
          setError(null);
        } else {
          setError(data.error?.message || "Failed to load categories and menu items");
        }
      } catch {
        if (!ignore) setError("Network error connecting to shop catalog API");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, [shop.id]);

  // Quick toggle product availability
  const handleToggleProductAvailability = async (product: MenuProduct) => {
    setUpdatingId(product.id);
    try {
      const res = await fetch(`/api/shops/${shop.id}/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically update local state
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            products: cat.products.map((p) =>
              p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
            ),
          }))
        );
      } else {
        alert(data.error?.message || "Failed to toggle product availability");
      }
    } catch {
      alert("Network error while updating product status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Quick toggle category availability
  const handleToggleCategoryAvailability = async (category: MenuCategory) => {
    setUpdatingId(category.id);
    try {
      const res = await fetch(`/api/shops/${shop.id}/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !category.isAvailable }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === category.id ? { ...c, isAvailable: !c.isAvailable } : c
          )
        );
      } else {
        alert(data.error?.message || "Failed to toggle category availability");
      }
    } catch {
      alert("Network error while updating category status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter products by search query
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => {
        const matchingProducts = cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
        const catMatches = cat.name.toLowerCase().includes(q);
        if (catMatches || matchingProducts.length > 0) {
          return {
            ...cat,
            products: catMatches ? cat.products : matchingProducts,
          };
        }
        return null;
      })
      .filter((cat): cat is MenuCategory => cat !== null);
  }, [categories, searchQuery]);

  const totalProducts = categories.reduce((sum, c) => sum + c.products.length, 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/shop/dashboard?shopId=${shop.id}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs mb-1"
            >
              <ArrowLeft className="size-3.5" /> Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Menu Management
            </h1>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {shop.name}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your shop&apos;s categories, products, prices, and availability in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCategoryToEdit(null);
              setIsCategoryModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Add Category
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setProductToEdit(null);
              setDefaultCategoryId(categories[0]?.id);
              setIsProductModalOpen(true);
            }}
            disabled={categories.length === 0}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Control & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
          <span>
            {categories.length} {categories.length === 1 ? "Category" : "Categories"} •{" "}
            {totalProducts} {totalProducts === 1 ? "Product" : "Products"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchCategories}
            disabled={loading}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && categories.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground rounded-xl border border-border bg-card">
          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
          Loading shop menu and categories...
        </div>
      ) : error ? (
        <div className="py-12 text-center text-xs text-destructive rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <AlertCircle className="size-6 mx-auto mb-2" />
          <p className="font-semibold text-sm mb-1">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchCategories}
            className="mt-3 text-xs"
          >
            Try Again
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-border bg-card/50 p-8">
          <Layers className="size-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Categories Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Get started by creating your first product category (e.g. Snacks, Meals, Drinks) to group your items.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setCategoryToEdit(null);
              setIsCategoryModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Create First Category
          </Button>
        </div>
      ) : (
        /* Categories and Products Sections */
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="overflow-hidden border-border/80">
              {/* Category Header Bar */}
              <CardHeader className="bg-muted/30 border-b border-border/60 py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {category.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/60">
                        /{category.slug}
                      </span>
                      <Badge
                        variant={category.isAvailable ? "default" : "destructive"}
                        className="text-[9px] uppercase px-1.5 py-0"
                      >
                        {category.isAvailable ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {/* Category Availability Toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={updatingId === category.id}
                    onClick={() => handleToggleCategoryAvailability(category)}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    title={
                      category.isAvailable
                        ? "Hide this category from students"
                        : "Make this category visible to students"
                    }
                  >
                    <Power className="size-3" />
                    <span className="hidden sm:inline">
                      {category.isAvailable ? "Hide" : "Show"}
                    </span>
                  </Button>

                  {/* Edit Category */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCategoryToEdit(category);
                      setIsCategoryModalOpen(true);
                    }}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="size-3" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>

                  {/* Add Product into this category */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProductToEdit(null);
                      setDefaultCategoryId(category.id);
                      setIsProductModalOpen(true);
                    }}
                    className="h-7 text-xs gap-1 ml-1"
                  >
                    <Plus className="size-3" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>

              {/* Products Grid in Category */}
              <CardContent className="p-4">
                {category.products.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <p>No products in this category yet.</p>
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => {
                        setProductToEdit(null);
                        setDefaultCategoryId(category.id);
                        setIsProductModalOpen(true);
                      }}
                      className="text-xs mt-1"
                    >
                      Add a product to {category.name}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.products.map((product) => (
                      <div
                        key={product.id}
                        className={`group relative rounded-xl border p-3 flex gap-3 transition-all ${
                          product.isAvailable
                            ? "border-border/80 bg-card hover:border-primary/40 shadow-xs"
                            : "border-border/40 bg-muted/20 opacity-75"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative size-16 rounded-lg bg-muted border border-border/60 overflow-hidden shrink-0 flex items-center justify-center">
                          {product.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="size-6 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {product.name}
                              </h4>
                              <span className="font-mono font-bold text-xs text-primary shrink-0">
                                {formatPriceINR(product.price)}
                              </span>
                            </div>

                            {product.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {product.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge
                                variant={product.isAvailable ? "outline" : "destructive"}
                                className="text-[9px] px-1 py-0 uppercase"
                              >
                                {product.isAvailable ? "In Stock" : "Out of Stock"}
                              </Badge>

                              {product.preparationTimeMins && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="size-3" />
                                  {product.preparationTimeMins}m
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-border/40">
                            {/* Fast Availability Toggle */}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updatingId === product.id}
                              onClick={() => handleToggleProductAvailability(product)}
                              className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                              title={
                                product.isAvailable
                                  ? "Mark out of stock"
                                  : "Mark in stock"
                              }
                            >
                              <Power className="size-3" />
                              {product.isAvailable ? "Mark Out" : "Mark In"}
                            </Button>

                            {/* Edit Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setProductToEdit(product);
                                setIsProductModalOpen(true);
                              }}
                              className="h-6 px-2 text-[10px] gap-1"
                            >
                              <Edit2 className="size-3" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddEditCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        shopId={shop.id}
        categoryToEdit={categoryToEdit}
        onSuccess={fetchCategories}
      />

      <AddEditProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        shopId={shop.id}
        categories={categories}
        productToEdit={productToEdit}
        defaultCategoryId={defaultCategoryId}
        onSuccess={fetchCategories}
      />
    </div>
  );
}
