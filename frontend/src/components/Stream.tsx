
import { SetlistEditor } from "./SetlistEditor";
// import { StreamChat } from "./StreamChat";

export function Stream() {
   
    return (
        <div className="flex gap-4">
                {/* <StreamChat></StreamChat> */}
                <SetlistEditor></SetlistEditor>
        </div>
    );
}