export interface ImagePromptCopyValidation {
  copies: string[];
  message: string;
  valid: boolean;
}

const COPY_GUIDANCE =
  '画面卖点文案可不设置；如需显示，最多 4 条并使用英文双引号包裹。';

export function validateImagePromptCopy(
  prompt: string
): ImagePromptCopyValidation {
  if (/[“”]/u.test(prompt)) {
    return invalid("请将中文弯引号改为英文双引号。");
  }

  const quoteCount = countAsciiQuotes(prompt);
  if (quoteCount === 0) {
    return {
      copies: [],
      message: `${COPY_GUIDANCE} 当前未设置画面文字。`,
      valid: true
    };
  }
  if (quoteCount % 2 !== 0) {
    return invalid("卖点文案的英文双引号未成对闭合。");
  }
  if (quoteCount > 8) {
    return invalid("画面卖点文案最多保留 4 条。");
  }

  const parts = prompt.split('"');
  const copies = parts
    .filter((_, index) => index % 2 === 1)
    .map((copy) => copy.trim());
  if (copies.length < 1 || copies.length > 4 || copies.some((copy) => !copy)) {
    return invalid("英文双引号中的卖点文案不能为空。");
  }

  return {
    copies,
    message: `已识别 ${copies.length} 条画面卖点文案。`,
    valid: true
  };
}

function countAsciiQuotes(value: string) {
  return [...value].filter((character) => character === '"').length;
}

function invalid(message: string): ImagePromptCopyValidation {
  return { copies: [], message, valid: false };
}
