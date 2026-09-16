export const POST_REACTION_OPTIONS = [
  { type: "cheer", label: "응원해요" },
  { type: "like", label: "좋아요" },
  { type: "fun", label: "재밌어요" },
  { type: "wow", label: "놀라워요" },
  { type: "sad", label: "슬퍼요" },
  { type: "applause", label: "칭찬해요" },
  { type: "cool", label: "멋져요" },
  { type: "thumbs-down", label: "별로예요" },
  { type: "skull", label: "해골투척" },
  { type: "congrat", label: "축하해요" },
] as const;

export type PostReactionType = (typeof POST_REACTION_OPTIONS)[number]["type"];

type ReactionIconProps = {
  type: PostReactionType;
  size?: 18 | 28;
};

export function PostReactionIcon({
  type,
  size = 28,
}: ReactionIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  };

  switch (type) {
    // 👍
    case "cheer":
      return (
        <svg {...commonProps}>
          <path
            fill="#FFC83D"
            d="M8.1 10.1 11 4.4c.5-1 1-2.4 1-3.4 2.2 0 3.5 1.8 3.1 3.9l-.8 4.2h4.9c1.7 0 2.9 1.6 2.5 3.2l-1.8 7.3c-.3 1.4-1.6 2.4-3.1 2.4H8.1V10.1Z"
          />
          <path
            fill="#FFB62E"
            d="M3 10h5.1v12H3a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Z"
          />
        </svg>
      );

    // ❤️
    case "like":
      return (
        <svg {...commonProps}>
          <path
            fill="#F04452"
            d="M12 21.2 3.5 13C.9 10.5 1 6.5 3.7 4.2 6.1 2.1 9.7 2.5 12 5c2.3-2.5 5.9-2.9 8.3-.8 2.7 2.3 2.8 6.3.2 8.8L12 21.2Z"
          />
        </svg>
      );

    // 😄
    case "fun":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" fill="#FFD54A" />
          <path
            fill="#3A3A3A"
            d="M6.5 10c.3-1.5 1.3-2.5 2.5-2.5s2.2 1 2.5 2.5H10c-.2-.6-.5-.9-1-.9s-.8.3-1 .9H6.5Zm6 0c.3-1.5 1.3-2.5 2.5-2.5s2.2 1 2.5 2.5H16c-.2-.6-.5-.9-1-.9s-.8.3-1 .9h-1.5Z"
          />
          <path
            fill="#3A3A3A"
            d="M6.3 13.1h11.4c-.5 4-2.6 6-5.7 6s-5.2-2-5.7-6Z"
          />
          <path
            fill="#F45B69"
            d="M9 17c.9-.8 1.9-1.1 3-1.1s2.1.3 3 1.1c-.8.7-1.8 1-3 1s-2.2-.3-3-1Z"
          />
        </svg>
      );

    // 😮
    case "wow":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" fill="#FFD54A" />
          <ellipse cx="8.2" cy="9" rx="1.2" ry="1.7" fill="#333" />
          <ellipse cx="15.8" cy="9" rx="1.2" ry="1.7" fill="#333" />
          <ellipse cx="12" cy="15.7" rx="2.6" ry="3.4" fill="#333" />
        </svg>
      );

    // 😢
    case "sad":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" fill="#FFD54A" />
          <ellipse cx="8.2" cy="10" rx="1.1" ry="1.5" fill="#333" />
          <ellipse cx="15.8" cy="10" rx="1.1" ry="1.5" fill="#333" />
          <path
            fill="#444"
            d="M8 17.5c.8-2 2.1-3 4-3 1.5 0 2.7.6 3.6 1.8l-1.3.9c-.6-.8-1.3-1.1-2.3-1.1-1.2 0-2 .6-2.6 1.9L8 17.5Z"
          />
          <path
            fill="#29A9E8"
            d="M17.2 11.8s-2.4 3.1-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.7-2.4-4.8-2.4-4.8Z"
          />
        </svg>
      );

    // 👏
    case "applause":
      return (
        <svg {...commonProps}>
          <path
            fill="#FFC83D"
            d="m5.4 11.2-2.1-2c-.7-.7-.7-1.7-.1-2.3.6-.6 1.6-.6 2.3.1l3.1 3-4-5c-.6-.8-.5-1.8.2-2.3.7-.5 1.7-.4 2.3.4l4.2 5.2-3-5.1c-.5-.8-.2-1.8.5-2.2.8-.4 1.7-.1 2.2.7l3.4 5.7-1.7-4.3c-.4-.9 0-1.8.8-2.1.8-.3 1.7.1 2.1 1l2.6 6.5.8-2.2c.4-1 1.4-1.5 2.4-1.1l.4.2-1 6.8c-.3 2.3-1.5 4.5-3.3 6l-.7.6c-2.6 2.2-6.4 2.1-8.9-.3l-5.2-5c-.7-.7-.7-1.7-.1-2.3.7-.7 1.7-.7 2.4 0l2.7 2.5-1.9-1.8c-.7-.7-.7-1.7 0-2.3.5-.5 1.4-.5 2 .1Z"
          />
          <path fill="#FF8A24" d="m19 1 1-1 1.2 3.6-1.7.5L19 1Z" />
          <path fill="#FF8A24" d="m21 6 3-1v1.8l-2.8.8L21 6Z" />
          <path fill="#FF8A24" d="m16.8 0 1.5.3-.8 3.1-1.6-.4.9-3Z" />
        </svg>
      );

    // 😎
    case "cool":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" fill="#FFD54A" />
          <path
            fill="#292D32"
            d="M3.2 8.2c2.1-.4 4.1-.5 6.1-.2.9.1 1.5.6 1.8 1.3.3-.2.6-.2.9-.2s.6 0 .9.2c.3-.7.9-1.2 1.8-1.3 2-.3 4-.2 6.1.2l-.2 1.5-.8.2c-.3 3-1.8 4.6-4.1 4.6-2 0-3.2-1.1-3.6-3.3h-.2c-.4 2.2-1.6 3.3-3.6 3.3-2.3 0-3.8-1.6-4.1-4.6l-.8-.2-.2-1.5Z"
          />
          <path
            fill="#4A3A25"
            d="M8.1 16.2c1.1 1.2 2.4 1.8 3.9 1.8s2.8-.6 3.9-1.8l1 1c-1.3 1.5-3 2.3-4.9 2.3s-3.6-.8-4.9-2.3l1-1Z"
          />
        </svg>
      );

    // 👎
    case "thumbs-down":
      return (
        <svg {...commonProps}>
          <path
            fill="#FFC83D"
            d="M8.1 13.9 11 19.6c.5 1 1 2.4 1 3.4 2.2 0 3.5-1.8 3.1-3.9l-.8-4.2h4.9c1.7 0 2.9-1.6 2.5-3.2l-1.8-7.3C19.6 3 18.3 2 16.8 2H8.1v11.9Z"
          />
          <path
            fill="#FFB62E"
            d="M3 2h5.1v12H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
          />
        </svg>
      );

    // 💀
    case "skull":
      return (
        <svg {...commonProps}>
          <path
            fill="#E8EDF2"
            d="M12 2C6.5 2 3 5.7 3 10.4c0 3.4 1.7 5.8 4.1 7.1V21c0 .6.4 1 1 1h2v-2h1v2h1.8v-2h1v2h2c.6 0 1-.4 1-1v-3.5c2.4-1.3 4.1-3.7 4.1-7.1C21 5.7 17.5 2 12 2Z"
          />
          <ellipse cx="8.3" cy="11.5" rx="2.2" ry="2.7" fill="#343A40" />
          <ellipse cx="15.7" cy="11.5" rx="2.2" ry="2.7" fill="#343A40" />
          <path fill="#343A40" d="m12 14-1.5 2.4h3L12 14Z" />
        </svg>
      );

    // 🥳
    case "congrat":
      return (
        <svg {...commonProps}>
          <circle cx="11.5" cy="13" r="8.5" fill="#FFD54A" />

          <path
            fill="#2785D8"
            d="M12.5 5.2 18.8 0 21 8.5l-8.5-3.3Z"
          />
          <path
            fill="#62B8F4"
            d="m16.1 2.2 2.7-2.2.8 3-3.5-.8Z"
          />

          <path
            fill="#4A3A25"
            d="M6.2 12.2c.5-1.5 1.5-2.3 2.8-2.3v1.5c-.6 0-1 .4-1.3 1.2l-1.5-.4Zm8.1.4c-.3-.8-.7-1.2-1.3-1.2V9.9c1.3 0 2.3.8 2.8 2.3l-1.5.4Z"
          />

          <path
            fill="#4A3A25"
            d="M7.8 15.3c1 1.4 2.2 2.1 3.7 2.1 1.4 0 2.6-.7 3.6-2.1l1.2.8c-1.2 1.9-2.8 2.8-4.8 2.8s-3.7-.9-4.9-2.8l1.2-.8Z"
          />

          <path fill="#F04452" d="m3 4 1.5-2 1.2 1-1.5 2L3 4Z" />
          <path fill="#29A9E8" d="m21 11 3-1v1.7l-2.7.8L21 11Z" />
          <path fill="#F04452" d="m20 16 2.5 1.5-.8 1.4-2.5-1.5.8-1.4Z" />
          <path fill="#FF9F1C" d="M2 17.5 4.5 16l.8 1.4-2.5 1.5-.8-1.4Z" />
        </svg>
      );
  }
}

export const DEFAULT_POST_REACTION_TYPE: PostReactionType = "cheer";

const POST_REACTION_TYPE_SET = new Set<string>(POST_REACTION_OPTIONS.map((option) => option.type));

export function isPostReactionType(value: string): value is PostReactionType {
  return POST_REACTION_TYPE_SET.has(value);
}

export function getPostReactionOption(type: PostReactionType) {
  return POST_REACTION_OPTIONS.find((option) => option.type === type) ?? POST_REACTION_OPTIONS[0];
}