import { useEffect, useState } from "react";
import type { DragOrderQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";
import { shuffle } from "../../utils/helpers";

export function DragOrder({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<DragOrderQuestion>) {
  const [order, setOrder] = useState<string[]>(() => {
    if (value && value.type === "drag-order" && value.order.length === question.items.length) {
      return value.order;
    }
    return shuffle(question.items);
  });

  // Sync to store on mount / change
  useEffect(() => {
    onChange({ type: "drag-order", order } satisfies UserAnswer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  function onDragStart(e: React.DragEvent, i: number) {
    e.dataTransfer.setData("text/plain", String(i));
    (e.currentTarget as HTMLElement).classList.add("dragging");
  }
  function onDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove("dragging");
  }
  function onDrop(e: React.DragEvent, dropAt: number) {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(from) || from === dropAt) return;
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(dropAt, 0, moved);
    setOrder(next);
  }

  return (
    <div className="space-y-2" aria-label="Order the items from top (first) to bottom (last)">
      <p className="text-sm text-slate-600">
        Drag items to reorder, or use the arrow buttons. Top = first step.
      </p>
      <ol className="space-y-2">
        {order.map((item, i) => {
          const correctItem = question.items[i];
          const isCorrectPos = revealed && correctItem === item;
          const isWrongPos = revealed && correctItem !== item;
          return (
            <li
              key={item + i}
              draggable={!revealed}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              onDrop={(e) => onDrop(e, i)}
              className={`flex items-center gap-3 rounded border p-2 bg-white ${
                isCorrectPos
                  ? "border-green-500 bg-green-50"
                  : isWrongPos
                  ? "border-red-500 bg-red-50"
                  : "border-slate-300"
              } ${revealed ? "" : "cursor-grab active:cursor-grabbing"}`}
            >
              <span className="w-6 text-slate-500 font-mono">{i + 1}.</span>
              <span className="flex-1">{item}</span>
              {!revealed && (
                <>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
                  >
                    ↓
                  </button>
                </>
              )}
              {revealed && isWrongPos && (
                <span className="text-xs text-red-700">
                  correct here: {correctItem}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
