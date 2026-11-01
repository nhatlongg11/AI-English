import { useRef, useState } from "react";
import { DragDropProvider, DragOverlay, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { arrayMove, move } from "@dnd-kit/helpers";
import { ArrowLeft, ArrowRight, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import type { WordToken } from "../../types";
type Groups = { pool: string[]; sentence: string[] };
export function transferWord(
  groups: Groups,
  id: string,
  target: keyof Groups,
): Groups {
  return {
    pool: groups.pool.filter((w) => w !== id),
    sentence: groups.sentence.filter((w) => w !== id),
    [target]: [...groups[target].filter((w) => w !== id), id],
  };
}
function Word({
  token,
  index,
  group,
  disabled,
  onTransfer,
  onReorder,
}: {
  token: WordToken;
  index: number;
  group: keyof Groups;
  disabled: boolean;
  onTransfer: () => void;
  onReorder: (direction: number) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: token.id,
    index,
    group,
    disabled,
    type: "word",
    accept: "word",
  });
  return (
    <div
      ref={ref}
      className={`word-token ${isDragging ? "dragging" : ""}`}
      data-token={token.text}
    >
      <button
        type="button"
        ref={handleRef}
        className="drag-handle"
        disabled={disabled}
        aria-label={`Kéo từ ${token.text}`}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onTransfer}
        aria-label={`${group === "pool" ? "Thêm" : "Trả"} từ ${token.text}`}
        style={{ color: "var(--foreground)", minHeight: 29 }}
      >
        {token.text}
      </button>
      {group === "sentence" && (
        <div className="word-controls">
          <button
            type="button"
            className="move-button"
            disabled={disabled || index === 0}
            aria-label={`Dịch ${token.text} sang trái`}
            onClick={() => onReorder(-1)}
          >
            <ArrowLeft size={12} />
          </button>
          <button
            type="button"
            className="move-button"
            disabled={disabled}
            aria-label={`Dịch ${token.text} sang phải`}
            onClick={() => onReorder(1)}
          >
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
function DropZone({
  id,
  children,
  empty,
}: {
  id: keyof Groups;
  children: React.ReactNode;
  empty: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: "container",
    accept: "word",
  });
  return (
    <div
      ref={ref}
      className={`${id === "pool" ? "word-pool" : "sentence-drop"} ${isDropTarget ? "over" : ""}`}
      aria-label={id === "pool" ? "Kho từ" : "Câu bạn đang ghép"}
    >
      {children}
      {empty && (
        <p className="small muted">
          {id === "pool"
            ? "Tất cả các từ đã được chọn."
            : "Kéo từ vào đây hoặc nhấn vào từng từ bên dưới."}
        </p>
      )}
    </div>
  );
}
export function SentenceBuilder({
  tokens,
  onChange,
  disabled = false,
}: {
  tokens: WordToken[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const initial = (): Groups => ({
    pool: tokens.map((t) => t.id),
    sentence: [],
  });
  const [groups, setGroups] = useState<Groups>(initial);
  const beforeDrag = useRef<Groups>(groups);
  const [announcement, setAnnouncement] = useState("");
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const update = (next: Groups) => {
    setGroups(next);
    onChange(next.sentence);
    setAnnouncement(
      `Câu hiện có ${next.sentence.length} từ: ${next.sentence.map((id) => byId.get(id)?.text).join(" ")}`,
    );
  };
  return (
    <DragDropProvider
      onDragStart={() => {
        beforeDrag.current = groups;
      }}
      onDragOver={(event) => {
        if (disabled) return;
        const next = move(groups, event);
        update(next);
      }}
      onDragEnd={(event) => {
        if (event.canceled) {
          update(beforeDrag.current);
          return;
        }
        update(move(groups, event));
      }}
    >
      <div className="stack">
        <div>
          <div className="progress-caption">
            <span>CÂU CỦA BẠN</span>
            <span>
              {groups.sentence.length}/{tokens.length} từ
            </span>
          </div>
          <DropZone id="sentence" empty={!groups.sentence.length}>
            {groups.sentence.map((id, index) => (
              <Word
                key={id}
                token={byId.get(id)!}
                index={index}
                group="sentence"
                disabled={disabled}
                onTransfer={() => update(transferWord(groups, id, "pool"))}
                onReorder={(direction) => {
                  const target = index + direction;
                  if (target >= 0 && target < groups.sentence.length)
                    update({
                      ...groups,
                      sentence: arrayMove(groups.sentence, index, target),
                    });
                }}
              />
            ))}
          </DropZone>
        </div>
        <div>
          <div className="progress-caption">
            <span>CÁC MẢNH NGÔN NGỮ</span>
            <span>Kéo để sắp xếp</span>
          </div>
          <DropZone id="pool" empty={!groups.pool.length}>
            {groups.pool.map((id, index) => (
              <Word
                key={id}
                token={byId.get(id)!}
                index={index}
                group="pool"
                disabled={disabled}
                onTransfer={() => update(transferWord(groups, id, "sentence"))}
                onReorder={() => {}}
              />
            ))}
          </DropZone>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="small muted">
            Bàn phím: nhấn Tab để chọn từ, Enter để thêm hoặc trả từ. Dùng nút ←
            → để đổi vị trí.
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => update(initial())}
          >
            <RotateCcw size={15} />
            Xếp lại
          </Button>
        </div>
        <div className="sr-only" aria-live="polite">
          {announcement}
        </div>
      </div>
      <DragOverlay>
        {(source) => {
          const token = byId.get(String(source.id));
          return token ? (
            <div className="word-token shadow-xl">{token.text}</div>
          ) : null;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
