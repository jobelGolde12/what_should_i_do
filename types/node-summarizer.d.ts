declare module "node-summarizer" {
  const Summarizer: {
    summarize(text: string, sentenceCount?: number): string;
  };
  export default Summarizer;
}
