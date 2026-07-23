// EDIT ME: example component showing the full loop with the Supabase adapter —
//   1. `authApi` sends the actual UPDATE with this component's own dynamic id/data
//   2. on success, `refresh()` (from useAuth) forces authDataClient's cached
//      bundle to re-fetch, so every other component reading that cache sees
//      the updated data too.
import { useState } from "react";
import { authApi } from "../api/authApi";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "snaparecord";

interface EditPostFormProps {
  postId: number;
  initialTitle: string;
  initialBody: string;
  onSaved?: () => void;
}

export function EditPostForm({ postId, initialTitle, initialBody, onSaved }: EditPostFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const { refresh } = useAuth();

  async function handleSave() {
    setSaving(true);
    try {
      // Real per-call filter — this is where dynamic ids work, unlike a
      // static authDataClient `requests` entry.
      await authApi.put("posts", { title, body }, { params: { eq: { id: postId } } });

      await refresh();
      toast.success("Post updated");
      onSaved?.();
    } catch {
      // authApi's error handling (see authApi.ts) already toasts/redirects on 401.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" />
      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
