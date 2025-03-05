interface UserBadgeProps {
  badge: string;
}

const UserBadge = ({ badge }: UserBadgeProps) => {
  if (!badge) return null;

  return (
    <span className="text-[12px] text-gray-400 font-normal -mt-[2px] block leading-tight">
      {badge}
    </span>
  );
};

export default UserBadge; 