"use client";

import { useActionState, useEffect, useRef } from "react";
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

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const file = item?.getAsFile();
      const input = fileInputRef.current;
      if (!file || !input) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      event.preventDefault();
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  return <form action={photoAction} className="settings-form">
    <PlayerIcon player={user} className="avatar" />
    <label htmlFor="avatarImage">Custom photo (PNG, JPEG, or GIF, up to 2MB)</label>
    <input ref={fileInputRef} id="avatarImage" name="avatarImage" type="file" accept="image/png,image/jpeg,image/gif" required />
    <small>You can also paste an image (Ctrl+V / Cmd+V) anywhere on this page.</small>
    <Feedback state={photoState} />
    <button className="button secondary" disabled={photoPending}>{photoPending ? "Uploading…" : "Upload photo"}</button>
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
