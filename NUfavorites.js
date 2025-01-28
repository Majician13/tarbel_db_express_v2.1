// Function to toggle the favorite status of a result
function toggleFavorite(resultId) {
  // 1. Get the current user's favorites from localStorage
  let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

  // 2. Check if the resultId is already in favorites
  const existingIndex = favorites.indexOf(resultId);

  if (existingIndex > -1) {
    // 3a. If yes, remove it
    favorites.splice(existingIndex, 1);
  } else {
    // 3b. If no, add it
    favorites.push(resultId);
  }

  // 4. Save the updated favorites to localStorage
  localStorage.setItem('favorites', JSON.stringify(favorites));
}
