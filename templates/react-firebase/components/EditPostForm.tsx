// EDIT ME: example component showing the full loop with the Firestore adapter —
//   1. `authApi` sends the actual updateDoc with this component's own dynamic
//      doc path/data
//   2. on success, `refresh()` (from useAuth) forces authDataClient's cached
//      bundle to re-fetch, so every other component reading that cache sees
//      the updated data too.
import { useState } from "react";
import { authApi } from "../api/authApi";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "snaparecord";

interface EditPostFormProps {
  postId: string;
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
      // Doc-path convention: "collection/id" — see authApi.ts.
      await authApi.put(`posts/${postId}`, { title, body });

      await refresh();
      toast.success("Post updated");
      onSaved?.();
    } catch {
      // authApi's error handling (see authApi.ts) already toasts/redirects on 401/403.
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
