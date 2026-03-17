export interface FormTabOption<T extends string> {
  value: T;
  label: string;
  content: React.ReactNode | ((insets: { bottom: number }) => React.ReactNode);
}
