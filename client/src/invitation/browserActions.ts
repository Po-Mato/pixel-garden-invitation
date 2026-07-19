type ClipboardWriter = { writeText(text: string): Promise<void> };

export type CalendarDownloadEnvironment = {
  createObjectUrl(blob: Blob): string;
  clickDownload(url: string, filename: string): void;
  revokeObjectUrl(url: string): void;
};

const browserDownloadEnvironment: CalendarDownloadEnvironment = {
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  clickDownload: (url, filename) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  },
  revokeObjectUrl: (url) => URL.revokeObjectURL(url)
};

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard
): Promise<void> {
  if (!clipboard) {
    throw new Error("클립보드를 사용할 수 없습니다.");
  }

  await clipboard.writeText(text);
}

export function downloadIcs(
  ics: string,
  environment: CalendarDownloadEnvironment = browserDownloadEnvironment
): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = environment.createObjectUrl(blob);

  try {
    environment.clickDownload(url, "wedding-event.ics");
  } finally {
    environment.revokeObjectUrl(url);
  }
}
