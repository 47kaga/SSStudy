"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Row } from "@/components/Row";
import type { StopSummary } from "@/lib/rewards";
import { formatDuration } from "@/lib/time";

type QuizPromptProps = {
  /** Worked out on the server when the session was stopped. The browser decides none of these numbers. */
  summary: StopSummary;
  onClose: () => void;
};

// "Test yourself now?" after a long session. Labeled rows only. "Later" and Escape both close it, and the
// session stays quizzable from Recent sessions.
export function QuizPrompt({ summary, onClose }: QuizPromptProps) {
  const router = useRouter();

  function takeQuiz() {
    router.push(`/quiz/${summary.sessionId}`);
    onClose();
  }

  return (
    <Modal title="Test yourself now?" onClose={onClose}>
      <div className="grid grid-cols-2 border-l-hairline border-t-hairline border-ink">
        <Row label="Time studied" value={formatDuration(summary.durationSeconds)} />
        <Row label="Most shards" value={String(summary.maxShards)} />
        <Row label="Material for full credit" value={`${summary.materialCharsNeeded} characters`} />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={takeQuiz} data-autofocus>
          Take quiz
        </Button>
        <Button onClick={onClose}>Later</Button>
      </div>
    </Modal>
  );
}
