export const formatDate = (dateString: string) => {
  if (!dateString || isNaN(new Date(dateString).getTime())) {
    return 'Invalid date';
  }

  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const time = `${hours}:${minutes}`;
  
  // Check if the date is today
  if (date.toDateString() === now.toDateString()) {
    return `${time} Today`;
  }
  
  // Check if the date was yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `${time} Yesterday`;
  }
  
  // For older dates, show the full date
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${time} ${day}.${month}.${year}`;
}; 