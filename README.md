# 🏢 MF GEM CRM Demo

Modern CRM application built with vanilla JavaScript ES6 modules, IndexedDB, and responsive design.

## 🚀 Features

- **ES6 Modules** - Clean, modular architecture
- **IndexedDB** - Client-side database storage
- **Responsive Design** - Works on desktop and mobile
- **Modern JavaScript** - No external dependencies
- **Sample Data** - Demo activities, resources, and PC numbers
- **Centralized Logging** - Built-in debug/info/error logging

## 📁 Project Structure

```
mf_gem_local/
├── gem.html          # Main application entry point
├── css/
│   └── styles.css    # Externalized CSS styles
├── js/
│   ├── main.js       # Application initialization
│   ├── database.js   # IndexedDB operations
│   ├── activities.js # Activities module
│   ├── resources.js  # Resources module
│   ├── ui-modals.js  # Modal management
│   └── utils.js      # Utility functions
├── audits_md/        # Documentation and audit reports
└── vercel.json       # Vercel deployment config
```

## 🛠️ Development

### Local Development
```bash
# Start local server
python3 -m http.server 8000

# Or using npm
npm run dev
```

Visit `http://localhost:8000/gem.html`

### 🔄 Auto-Deployment on Vercel

This project is configured for automatic deployment on Vercel:

1. **GitHub Integration** - Every push to `main` triggers deployment
2. **Static Site** - No build process needed
3. **Custom Routes** - Proper handling of assets and SPA routing

## 📊 Sample Data

The application includes sample data:
- **PC Numbers**: 2 project entries
- **Activities**: 3 scheduled activities  
- **Resources**: 4 equipment/vehicle entries

## 🏗️ Architecture

### ES6 Modules
- **main.js** - Application coordinator
- **database.js** - Data persistence layer
- **activities.js** - Activity management
- **resources.js** - Resource management
- **ui-modals.js** - UI interaction layer
- **utils.js** - Shared utilities

### IndexedDB Schema
- `pcNumbers` - Project/client data
- `activities` - Scheduled activities
- `resources` - Equipment and vehicles
- `quotes` - Quote management
- `priceLists` - Pricing data
- `templates` - Reusable templates

## 🔧 Technical Details

- **No Build Process** - Pure vanilla JavaScript
- **ES6 Modules** - Native browser module support
- **IndexedDB** - Async local database
- **Responsive CSS** - Mobile-first design
- **Error Handling** - Comprehensive try/catch blocks
- **JSDoc** - Full function documentation

## 🚀 Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Auto-deployment on every commit to `main`
3. Custom domain support available

### Manual Deployment
1. Upload all files to web server
2. Ensure MIME types are correct for `.js` files
3. Enable HTTPS for IndexedDB access

## 📈 Performance

- **Lazy Loading** - Modules loaded on demand
- **IndexedDB** - Fast local storage
- **Minimal Dependencies** - No external libraries
- **Optimized CSS** - Efficient styling
- **Tree Shaking Ready** - ES6 module structure

## 🔐 Security

- XSS Protection via input sanitization
- CSP headers configured
- No external CDN dependencies
- Local data storage only

---

**Live Demo**: [Deployed on Vercel](https://your-vercel-url.vercel.app)