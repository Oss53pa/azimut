export type SvgDiff = {
  identical: boolean;
  expected_length: number;
  actual_length: number;
  first_diff_index: number | null;
  context: string | null;
};

export function compareSvg(expected: string, actual: string): SvgDiff {
  if (expected === actual) {
    return {
      identical: true,
      expected_length: expected.length,
      actual_length: actual.length,
      first_diff_index: null,
      context: null,
    };
  }

  const minLen = Math.min(expected.length, actual.length);
  let diffIndex = 0;
  while (diffIndex < minLen && expected[diffIndex] === actual[diffIndex]) {
    diffIndex++;
  }

  const contextStart = Math.max(0, diffIndex - 40);
  const contextEnd = Math.min(
    Math.max(expected.length, actual.length),
    diffIndex + 40,
  );
  const context = [
    `expected: ...${expected.substring(contextStart, contextEnd)}...`,
    `actual:   ...${actual.substring(contextStart, contextEnd)}...`,
    `${' '.repeat(14 + diffIndex - contextStart)}^`,
  ].join('\n');

  return {
    identical: false,
    expected_length: expected.length,
    actual_length: actual.length,
    first_diff_index: diffIndex,
    context,
  };
}

export function assertSvgEqual(expected: string, actual: string): void {
  const diff = compareSvg(expected, actual);
  if (!diff.identical) {
    throw new Error(
      `SVG mismatch at index ${diff.first_diff_index ?? 0}\n${diff.context ?? ''}`,
    );
  }
}
