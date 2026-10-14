const { PUBLIC_URL } = require('../config');

const photoUrl = (id) => (id ? `${PUBLIC_URL}/photos/${id}` : null);

module.exports = { photoUrl };
