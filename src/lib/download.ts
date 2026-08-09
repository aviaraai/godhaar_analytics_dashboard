import type { DebugImage } from "@/lib/api";

/**
 * Which side of a comparison a photo came from. It is the only thing that
 * distinguishes the two files once they are sitting in a downloads folder —
 * `front1.jpg` and `front1.jpg` say nothing about which one the model was shown
 * and which one it matched against — so it leads the filename.
 */
export type PhotoOrigin = "uploaded" | "db";

/** Anything that cannot appear in a filename on every platform we care about. */
const UNSAFE = /[^a-z0-9]+/gi;

/**
 * `uploaded_front_1`, `db_muzzle_2`. Slot and sequence come straight off the
 * record, including the backend's `unknown`/`0` fallback for an object key it
 * could not parse — a photo whose slot is unreadable still downloads, under a
 * name that says so.
 *
 * `slot` is sanitised because it is server-supplied text on its way into a
 * filename, and a slot value that has picked up a slash or a dot would either
 * be rejected by the browser or silently change the file's extension.
 */
export function photoFileName(image: DebugImage, origin: PhotoOrigin): string {
  const slot = image.slot.replace(UNSAFE, "_").toLowerCase() || "unknown";
  return `${origin}_${slot}_${image.sequence}`;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

/**
 * The object key carries the real extension (`debug/{uuid}/{slot}{seq}.{ext}`),
 * so the URL is read first and the response's content type is only the fallback
 * — a bucket serving `application/octet-stream` must not cost us a `.jpg` we
 * already knew about. Both failing lands on jpeg, which is what the app uploads.
 */
function extensionFor(url: string, contentType: string): string {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // A relative or malformed URL still has a path-shaped tail worth reading.
  }

  const suffix = /\.([a-z0-9]{2,5})$/i.exec(pathname);
  if (suffix) return suffix[1].toLowerCase();

  const mime = contentType.split(";")[0].trim().toLowerCase();
  return MIME_EXTENSIONS[mime] ?? "jpg";
}

/* -------------------------------------------------------------------------- */
/* Where the bytes go                                                          */
/* -------------------------------------------------------------------------- */

type DirectoryPickerOptions = {
  /** Chrome reopens the picker wherever this id was last pointed. */
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads" | "pictures";
};

// Not in lib.dom yet, though `FileSystemDirectoryHandle` and the write side of
// it are. Optional because Firefox and Safari do not implement the picker.
declare global {
  interface Window {
    showDirectoryPicker?: (
      options?: DirectoryPickerOptions,
    ) => Promise<FileSystemDirectoryHandle>;
  }
}

/** Whether this browser can be asked for a folder to write a whole batch into. */
export const canPickFolder = (): boolean =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export type FolderChoice =
  | { kind: "folder"; handle: FileSystemDirectoryHandle }
  | { kind: "unsupported" }
  | { kind: "cancelled" };

/**
 * Asks for one folder to put a whole record in.
 *
 * This exists because of Chrome's "ask where to save each file" setting: with
 * it on, an `<a download>` opens a Save As dialog *per file*, so a ten-photo
 * record is ten dialogs. A directory handle is granted once and written to
 * directly, which the setting has no say over.
 *
 * Must be called straight out of a click — the picker needs transient user
 * activation, and awaiting anything first spends it.
 *
 * Cancelling is a decision and stops the batch; anything else that goes wrong
 * is treated as the picker not being usable, which falls back to saving one
 * file at a time rather than leaving the reviewer with nothing.
 */
export async function chooseFolder(): Promise<FolderChoice> {
  const picker = window.showDirectoryPicker;
  if (!picker) return { kind: "unsupported" };

  try {
    return {
      kind: "folder",
      handle: await picker.call(window, {
        id: "godhaar-debug-photos",
        mode: "readwrite",
        startIn: "downloads",
      }),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { kind: "cancelled" };
    }
    return { kind: "unsupported" };
  }
}

/** True when the folder already holds a file of this name. */
async function taken(
  folder: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * `uploaded_front_1.jpg`, then `uploaded_front_1 (2).jpg`, exactly as the
 * browser would. Two records both have an `uploaded_front_1`, and silently
 * overwriting the first reviewer's evidence with the second's is the one
 * outcome worth going out of the way to avoid.
 */
async function freeName(
  folder: FileSystemDirectoryHandle,
  filename: string,
): Promise<string> {
  const dot = filename.lastIndexOf(".");
  const stem = dot === -1 ? filename : filename.slice(0, dot);
  const extension = dot === -1 ? "" : filename.slice(dot);

  for (let n = 1; n < 100; n += 1) {
    const candidate = n === 1 ? filename : `${stem} (${n})${extension}`;
    if (!(await taken(folder, candidate))) return candidate;
  }
  // A hundred copies of the same photo means something else is wrong; take the
  // name and let it overwrite rather than refusing to save at all.
  return filename;
}

async function writeInto(
  folder: FileSystemDirectoryHandle,
  blob: Blob,
  filename: string,
): Promise<void> {
  const handle = await folder.getFileHandle(await freeName(folder, filename), {
    create: true,
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    // Leaving the stream open would hold a lock on a half-written file.
    await writable.abort().catch(() => {});
    throw error;
  }
}

/**
 * Saved through a blob rather than by pointing an `<a download>` at the URL,
 * because `download` is ignored cross-origin: the anchor would still fetch the
 * photo from storage.googleapis.com, but under the object's own opaque name.
 * The naming is the entire point of this, so the bytes come to us first.
 */
function save(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick as the click cancels the save in Firefox, so the
  // handle is held well past the point the browser has taken the bytes.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/**
 * Downloads one presigned photo as `{origin}_{slot}_{sequence}.{ext}`.
 *
 * Into `folder` when one has been granted, and through the browser's own
 * download machinery otherwise — which for a single photo is the right thing
 * anyway: one file is one Save As dialog, and asking for a folder first would
 * be two prompts to save one image.
 *
 * The two ways this fails ask different things of the reader, so they are
 * worded apart. A refused response is the fifteen-minute signature running out,
 * and the only remedy is to refetch the record for freshly signed links —
 * nothing re-signs a single URL. A failed request never reached storage at all:
 * the network, or the bucket declining a cross-origin read from this site,
 * which no amount of refreshing will fix.
 */
export async function downloadPhoto(
  image: DebugImage,
  origin: PhotoOrigin,
  folder?: FileSystemDirectoryHandle | null,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(image.url);
  } catch {
    throw new Error(
      "Could not reach storage for this photo. Check your connection — if it keeps failing, the bucket is refusing downloads from this site.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Storage refused this photo (${response.status}). Its link has expired — refresh the record and try again.`,
    );
  }

  const blob = await response.blob();
  const filename = `${photoFileName(image, origin)}.${extensionFor(image.url, blob.type)}`;

  if (folder) {
    await writeInto(folder, blob, filename);
    return;
  }
  save(blob, filename);
}

/* -------------------------------------------------------------------------- */
/* Whole records                                                               */
/* -------------------------------------------------------------------------- */

/** One photo and the side of the comparison it came from. */
export type PhotoDownload = { image: DebugImage; origin: PhotoOrigin };

export type BatchProgress = { done: number; total: number };

export type BatchResult = { saved: number; failed: number; total: number };

/**
 * Everything a comparison is made of, in the order it is read: what was
 * submitted, then what it was matched against. Both sides arrive from the API
 * already ordered by slot and sequence, and that order is kept — the files land
 * in the folder in the same order they sit on the screen.
 */
export function photoBatch(
  submitted: DebugImage[],
  matched: DebugImage[] | undefined,
): PhotoDownload[] {
  return [
    ...submitted.map((image) => ({ image, origin: "uploaded" as const })),
    ...(matched ?? []).map((image) => ({ image, origin: "db" as const })),
  ];
}

/**
 * Browsers drop saves that arrive in the same tick as each other, and Chrome in
 * particular wants a beat between them. Long enough to be reliable, short
 * enough that ten photos still finish in a couple of seconds. Writing into a
 * granted folder goes nowhere near that machinery and needs no gap.
 */
const SAVE_GAP_MS = 150;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type BatchOptions = {
  /** Granted by `chooseFolder`. Without one, each photo is saved separately. */
  folder?: FileSystemDirectoryHandle | null;
  onProgress?: (progress: BatchProgress) => void;
};

/**
 * Saves a whole record's photos, one file each, under the same names the
 * individual buttons write — `uploaded_front_1.jpg` through `db_muzzle_3.jpg`.
 * No archive: ten separately named files are what a reviewer wants to drop into
 * a ticket, and zipping them would put a step between them and that.
 *
 * Sequential on purpose. Ten parallel fetches against presigned URLs is a
 * needless burst, the browser will not accept ten saves at once anyway, and
 * doing them in order is what makes the progress count mean anything.
 *
 * One dead link must not cost the other nine, so each is caught and the run
 * continues; the count of failures comes back for the caller to report. Without
 * a folder there is a second failure this cannot see at all: a browser refusing
 * multiple automatic downloads reports success and quietly keeps only the first
 * file. That is unobservable from script, which is why the caller warns about
 * the prompt — and why offering a folder is the better path when there is one.
 */
export async function downloadPhotos(
  photos: PhotoDownload[],
  { folder, onProgress }: BatchOptions = {},
): Promise<BatchResult> {
  const total = photos.length;
  let saved = 0;
  let failed = 0;

  for (const [index, { image, origin }] of photos.entries()) {
    onProgress?.({ done: index, total });
    try {
      await downloadPhoto(image, origin, folder);
      saved += 1;
    } catch {
      failed += 1;
    }
    if (!folder && index < total - 1) await pause(SAVE_GAP_MS);
  }

  onProgress?.({ done: total, total });
  return { saved, failed, total };
}
