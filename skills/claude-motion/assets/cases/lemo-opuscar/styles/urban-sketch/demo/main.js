const q = new URLSearchParams(location.search);
if (q.get('look')) await import('./look.js'); else if (q.get('sheet')) await import('./sheet.js'); else if (q.get('api')) await import('./api.js'); else await import('./film.js');
