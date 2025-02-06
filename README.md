<!DOCTYPE html>
<html>
<head>

</head>
<body>

<h1>Tarbell Database Application</h1>

<p>This Node.js application provides a web interface for interacting with a database of magic cards from the Tarbell Course in Magic. Users can search for cards, view all entries, mark cards as favorites, and manage their favorite cards.</p>

<h2>Features</h2>

<ul>
  <li>User authentication: Securely register and log in to manage personal favorites.</li>
  <li>Search functionality: Search for cards by various criteria like lesson, subject, title, etc.</li>
  <li>Favorites management: Mark cards as favorites and view them on a dedicated page.</li>
  <li>Real-time updates: See favorite status changes and card removals instantly using Socket.IO.</li>
  <li>Responsive design: The interface is built with CSS and adapts to different screen sizes.</li>
</ul>

<h2>Technologies Used</h2>

<ul>
  <li>Node.js</li>
  <li>Express.js</li>
  <li>PostgreSQL</li>
  <li>EJS (Embedded JavaScript Templates)</li>
  <li>Socket.IO</li>
  <li>bcrypt (for password hashing)</li>
  <li>express-session and connect-pg-simple (for session management)</li>
</ul>

<h2>Installation</h2>

<ol>
  <li>Clone the repository: <code>git clone &lt;repository-url&gt;</code></li>
  <li>Install dependencies: <code>npm install</code></li>
  <li>Configure database connection: Update <code>config.json</code> with your PostgreSQL credentials.</li>
  <li>Start the server: <code>node index.js</code></li>
</ol>

<h2>Usage</h2>

<ol>
  <li>Register a new account or log in.</li>
  <li>Use the search bar to find specific cards.</li>
  <li>Click the star icon on a card to mark it as a favorite.</li>
  <li>View your favorite cards on the "Favorites" page.</li>
</ol>

<h2>Contributing</h2>

<p>Feel free to submit pull requests or open issues for any bugs or feature requests.</p>

<h2>License</h2>

<p>This project is licensed under the MIT License.</p>

</body>
</html>
