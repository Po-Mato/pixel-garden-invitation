export class GardenRoom {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    return new Response("Garden room is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
}
