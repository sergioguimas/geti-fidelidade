type PageFeedbackProps = {
  error: string | null;
};

export function PageFeedback({ error }: PageFeedbackProps) {
  if (!error) return null;

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error}
    </section>
  );
}