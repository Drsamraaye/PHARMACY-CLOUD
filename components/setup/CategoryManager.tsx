"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string; user: string; date: string };

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/setup/category", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Categories lama soo rari karin.");
      setCategories(result.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Categories lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/setup/category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Category lama kaydin karin.");
      setName(""); setNotice("Category waa la kaydiyey."); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category lama kaydin karin.");
    } finally { setSaving(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/setup/category", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, data: { name: editName.trim() } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Category lama cusboonaysiin karin.");
      setEditing(null); setNotice("Category waa la cusboonaysiiyey."); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category lama cusboonaysiin karin.");
    } finally { setSaving(false); }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/setup/category", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Category lama tirtiri karin.");
      setNotice("Category waa la tirtiray."); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category lama tirtiri karin.");
    }
  }

  return <main className="category-management-page">
    <section className="category-management-card">
      <header><h1>Product Categories</h1></header>
      <form className="category-add-form" onSubmit={addCategory}>
        <input aria-label="Category name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Category name" />
        <button disabled={saving}>{saving ? "Saving…" : "Add"}</button>
        <button type="button" className="category-refresh" onClick={() => void load()} disabled={loading}>Refresh</button>
      </form>
      {error && <p className="category-message category-error" role="alert">{error}</p>}
      {notice && <p className="category-message category-success" role="status">{notice}</p>}
      <div className="category-table-scroll"><table>
        <thead><tr><th>Name</th><th>User</th><th>Date</th><th>Action</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={4} className="category-empty">Loading…</td></tr>
            : categories.length ? categories.map(category => <tr key={category.id}><td>{category.name}</td><td>{category.user}</td><td>{new Date(category.date).toLocaleDateString()}</td><td><button className="category-edit" onClick={() => { setEditing(category); setEditName(category.name); }}>Edit</button><button className="category-delete" onClick={() => void deleteCategory(category)}>Delete</button></td></tr>)
              : <tr><td colSpan={4} className="category-empty">No categories found. Add a category above.</td></tr>}
        </tbody>
      </table></div>
    </section>
    {editing && <div className="category-modal-backdrop"><form className="category-modal" onSubmit={saveEdit}><h2>Edit Category</h2><label>Category name<input required minLength={2} maxLength={100} value={editName} onChange={event => setEditName(event.target.value)} /></label>{error && <p className="category-message category-error" role="alert">{error}</p>}<footer><button type="button" className="category-cancel" onClick={() => setEditing(null)}>Cancel</button><button className="category-edit" disabled={saving}>{saving ? "Saving…" : "Save"}</button></footer></form></div>}
  </main>;
}
