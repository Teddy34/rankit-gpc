"use client";

import { useActionState, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { profileAvatars } from "@/domain/profile";
import { PlayerIcon } from "../player-icon";
import { removeAvatarImage, requestEmailChange, updateProfile, uploadAvatar, type SettingsState } from "./actions";

type UserSettings = { displayName: string; avatar: string; avatarImageUrl: string | null; email: string };
const initialState: SettingsState = {};

function Feedback({ state }: { state: SettingsState }) {
  if (!state.message) return null;
  return <p className={state.status === "error" ? "form-error" : "form-success"} role="status">{state.message}</p>;
}

function PhotoUploadForm({ user }: { user: UserSettings }) {
  const [photoState, photoAction, photoPending] = useActionState(uploadAvatar, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // A successful save changes user.avatarImageUrl (a fresh round-trip from the server, via
  // revalidatePath) -- that's the authoritative signal a pending selection is now saved, so
  // reset against it directly during render rather than chasing it from an effect.
  const [lastSavedUrl, setLastSavedUrl] = useState(user.avatarImageUrl);
  if (user.avatarImageUrl !== lastSavedUrl) {
    setLastSavedUrl(user.avatarImageUrl);
    setSelectedName(null);
  }

  function applyFile(file: File) {
    const input = fileInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setSelectedName(file.name || "Pasted image");
  }

  // A paste event only fires reliably on a genuinely editable element (input/textarea/
  // contenteditable) -- a plain focusable <div> is not guaranteed to receive it at all in
  // every browser, which is why the previous version of this didn't actually work. A real
  // (visually disguised) text input sidesteps that entirely.
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) applyFile(file);
  }

  return <form action={photoAction} className="settings-form">
    <PlayerIcon player={user} className="avatar" />
    <label htmlFor="avatarImage">Custom photo (PNG, JPEG, or GIF, up to 2MB)</label>
    <input
      key={user.avatarImageUrl ?? "none"}
      ref={fileInputRef}
      id="avatarImage"
      name="avatarImage"
      type="file"
      accept="image/png,image/jpeg,image/gif"
      required
      onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? null)}
    />
    <input type="text" className="paste-zone" placeholder="Or click here and paste an image (Ctrl+V / Cmd+V)" onPaste={handlePaste} />
    {selectedName && <p className="form-success">✓ Ready to upload: {selectedName}</p>}
    <Feedback state={photoState} />
    <button className="button secondary" disabled={photoPending}>{photoPending ? "Uploading…" : selectedName ? `Upload ${selectedName}` : "Upload photo"}</button>
  </form>;
}

export function ProfileForm({ user }: { user: UserSettings }) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeAvatarImage, initialState);
  return <>
    <form action={action} className="settings-form">
      <label htmlFor="displayName">Display name</label>
      <input id="displayName" name="displayName" defaultValue={user.displayName} minLength={2} maxLength={40} required />
      <fieldset><legend>Icon</legend><div className="avatar-picker">
        {profileAvatars.map((avatar) => <label key={avatar}><input type="radio" name="avatar" value={avatar} defaultChecked={avatar === user.avatar} /><span>{avatar}</span></label>)}
      </div></fieldset>
      <Feedback state={state} />
      <button className="button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
    <PhotoUploadForm user={user} />
    {user.avatarImageUrl && <form action={removeAction} className="settings-form">
      <small>Remove your photo to go back to your emoji icon.</small>
      <Feedback state={removeState} />
      <button className="button secondary" disabled={removePending}>{removePending ? "Removing…" : "Remove photo"}</button>
    </form>}
  </>;
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(requestEmailChange, initialState);
  return <form action={action} className="settings-form">
    <label htmlFor="email">Email address</label>
    <input id="email" name="email" type="email" defaultValue={email} required />
    <small>We’ll send a confirmation link to the new address. Its domain must be allowed.</small>
    <Feedback state={state} />
    <button className="button secondary" disabled={pending}>{pending ? "Sending…" : "Change email"}</button>
  </form>;
}
