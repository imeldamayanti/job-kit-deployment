const MIN_FRAME_SIZE = 200

function canRead(frame: HTMLIFrameElement): boolean {
  try {
    return frame.contentDocument !== null
  } catch {
    return false
  }
}

// A frame from another site is a locked box: the browser will not let this page's scripts look inside.
// Small ones are almost always tracking pixels or ads, so only frames big enough to hold a form count.
export function hasLockedFrame(doc: Document): boolean {
  return Array.from(doc.querySelectorAll('iframe')).some((frame) => {
    const { width, height } = frame.getBoundingClientRect()
    return width >= MIN_FRAME_SIZE && height >= MIN_FRAME_SIZE && !canRead(frame)
  })
}
