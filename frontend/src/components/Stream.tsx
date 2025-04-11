
import { SetlistEditor } from "./SetlistEditor";

export function Stream() {
   
    return (
        <div className="grid grid-cols-1 gap-10">
            <div>
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Status</h3>
                <SetlistEditor></SetlistEditor>
            </div>
        </div>
    );
}