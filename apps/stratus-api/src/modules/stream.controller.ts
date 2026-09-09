import { Controller, Sse } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { ApiTags } from "@nestjs/swagger";
import type { LiveStream} from "./live-stream.service.js";
import { type LiveEvent } from "./live-stream.service.js";

@ApiTags("stream")
@Controller("stream")
export class StreamController {
  constructor(private readonly live: LiveStream) {}

  /** Server-sent events consumed by the console's live activity feed. */
  @Sse()
  stream(): Observable<{ data: LiveEvent }> {
    return this.live.events$.pipe(map((event) => ({ data: event })));
  }
}
