export type ImagePreloadPriority = "high" | "low";

type ImageRequest = {
  image: HTMLImageElement;
  priority: ImagePreloadPriority;
  promise: Promise<boolean>;
};

const imageRequests = new Map<string, ImageRequest>();

export function preloadImage(url: string, priority: ImagePreloadPriority = "low") {
  if (typeof Image === "undefined") return Promise.resolve(false);

  const pending = imageRequests.get(url);
  if (pending) {
    if (priority === "high" && pending.priority === "low") {
      pending.priority = "high";
      pending.image.fetchPriority = "high";
    }
    return pending.promise;
  }

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = priority;

  const request = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => {
      imageRequests.delete(url);
      resolve(false);
    };
  });

  imageRequests.set(url, { image, priority, promise: request });
  image.src = url;
  return request;
}
