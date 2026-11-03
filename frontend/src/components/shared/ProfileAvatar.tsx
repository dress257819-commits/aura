import { useState, type ComponentProps } from "react";

export const DEFAULT_PROFILE_AVATAR = "/default-profile-avatar.png";

type ProfileAvatarProps = Omit<ComponentProps<"img">, "src" | "alt" | "onError"> & {
  src?: string | null;
  name: string;
};

export function ProfileAvatar({ src, name, ...props }: ProfileAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSource = src && failedSource !== src ? src : DEFAULT_PROFILE_AVATAR;

  return (
    <img
      {...props}
      src={imageSource}
      alt={name ? `${name}'s profile photo` : "Example profile avatar"}
      onError={() => {
        if (imageSource !== DEFAULT_PROFILE_AVATAR) setFailedSource(imageSource);
      }}
    />
  );
}
