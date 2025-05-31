import { SetlistEditor } from "./setlist-editor";
import { StreamChat } from "./stream-chat";

export function Stream() {
   
    return (
        <div className="flex gap-4">
                <StreamChat></StreamChat>
                <SetlistEditor></SetlistEditor>
        </div>
    );
}