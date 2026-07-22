// EDIT ME: example component showing the full loop —
//   1. `authApi` sends the actual PUT with this component's own dynamic id/data
//   2. on success, `refresh()` (from useAuth) forces authDataClient's cached
//      bundle to re-fetch, so every other component reading that cache
//      (e.g. a profile header showing `user`) sees the updated data too.
//
// Swap the url/fields for your real endpoint once `authApi`'s baseURL points at your
// backend instead of jsonplaceholder.typicode.com. If this record type isn't part
// of your cached bundle at all, you can skip step 2 and just call `onSaved?.()`.
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
      // Real template literal + real variable — this is where "/posts/{id}" style
      // dynamic urls actually work, unlike a static authDataClient `requests` entry.
      await authApi.put(`/posts/${postId}`, { id: postId, title, body, userId: 1 });

      // Push the change into the cached bundle so every consumer of
      // authGetClient (profile header, sidebar, etc.) sees it right away.
      await refresh();

      toast.success("Post updated");
      onSaved?.();
    } catch {
      // authApi's onError (see authApi.ts) already handles 401s globally;
      // add any extra per-call error handling here if needed.
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
