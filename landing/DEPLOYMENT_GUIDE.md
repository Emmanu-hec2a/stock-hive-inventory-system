# StočkHive Landing Page — Deployment & SEO Guide

## 📁 File Structure

```
landing/
├── index.html           # Main landing page (SEO-optimized)
├── sitemap.xml         # XML sitemap for Google
├── robots.txt          # Crawl instructions for search engines
├── images/             # [CREATE THIS FOLDER]
│   └── hero-screenshot.png    # Hero section screenshot (600x400, <100KB)
├── icons/              # [CREATE THIS FOLDER]
│   ├── favicon-32x32.png      # Browser tab icon
│   ├── apple-touch-icon.png   # iOS home screen icon
│   └── icon-512x512.png       # PWA icon for Google listings
└── og-image.png        # Social media preview image (1200x630, <100KB)
```

## 🚀 Deployment Options

### Option 1: Railway (Recommended — same as your app)

1. **Create a new Railway project**
   - Go to [railway.app](https://railway.app)
   - Create new project → Static Site
   - Connect to your GitHub repo (or upload files directly)

2. **Configure Railway**
   - Set custom domain: `stockhive.co.ke`
   - Set root directory: `landing/`
   - Deploy!

3. **DNS Setup**
   - In your domain registrar (Namecheap, Hostinger, etc.):
     - Add CNAME record: `stockhive.co.ke` → Railway domain
     - Or update nameservers to Railway's nameservers

---

### Option 2: Netlify (Free, fast CDN)

1. **Drag & drop deployment**
   - Go to [netlify.com](https://netlify.com)
   - Drag the `landing/` folder onto the upload area
   - Set custom domain: `stockhive.co.ke`

2. **Or connect GitHub**
   - Link your repo
   - Set build directory: `landing/`
   - Auto-deploys on every push

3. **DNS**
   - Update your domain registrar to point to Netlify

---

### Option 3: GitHub Pages (Free, but less flexible)

1. **Rename folder to `docs/`**
2. **Push to GitHub**
3. **Settings → Pages → Source: Deploy from branch `main/docs`**
4. **Set custom domain**

---

## 🖼️ Image Setup (Critical for Performance)

Your landing page references these images — you **must** create them:

### 1. Hero Screenshot (`images/hero-screenshot.png`)
- **Size**: 600×400px
- **File size**: Keep under 100KB (use TinyPNG or Squoosh)
- **Format**: PNG or WebP
- **Content**: Screenshot of your StočkHive dashboard showing stock levels
- **Alt text**: Already optimized in HTML ✅

### 2. OG Image (`og-image.png`)
- **Size**: 1200×630px (Facebook/Twitter standard)
- **File size**: Keep under 200KB
- **Content**: Marketing image with StočkHive logo, headline, and call-to-action
- **Used for**: Social media previews when someone shares the link

### 3. Favicon (`icons/favicon-32x32.png`)
- **Size**: 32×32px
- **Content**: Your StočkHive logo or icon

### 4. Apple Touch Icon (`icons/apple-touch-icon.png`)
- **Size**: 180×180px
- **Content**: App icon for iOS home screen

### 5. PWA Icon (`icons/icon-512x512.png`)
- **Size**: 512×512px
- **Content**: Full-sized app icon for listing in app stores

**Image Optimization Tips:**
- Use [TinyPNG](https://tinypng.com) (free) to compress
- Use [Squoosh](https://squoosh.app) for WebP conversion (better compression)
- Never upload images larger than needed — crop first
- Test: Use [GTmetrix](https://gtmetrix.com) or [Lighthouse](https://developers.google.com/web/tools/lighthouse)

---

## 🔍 SEO Checklist

### ✅ Implemented in This Landing Page

- [x] **H1 tag** with primary keyword: "Inventory Management Built for Kenyan Shops"
- [x] **Meta description** (160 chars) targeting main keywords
- [x] **Canonical URL** to prevent duplicate content issues
- [x] **Open Graph tags** for social media sharing
- [x] **Twitter Card** tags for Twitter/X sharing
- [x] **Geo-targeting** (Kenya location data)
- [x] **JSON-LD Schema Markup**
  - SoftwareApplication schema (with pricing tiers)
  - Organization schema
  - FAQPage schema (7 FAQs — great for featured snippets)
- [x] **Semantic HTML** (`<h1>`, `<h2>`, `<h3>`, `<details>`)
- [x] **Image alt text** with keywords
- [x] **Preload critical resources** (fonts, hero image)
- [x] **Mobile-responsive design** (works on all devices)
- [x] **robots.txt** (tells Google what to crawl)
- [x] **Sitemap** (helps Google find all pages)

### 📋 Manual Setup Required

1. **Google Search Console**
   ```
   1. Go to https://search.google.com/search-console
   2. Add property: stockhive.co.ke
   3. Verify ownership (add DNS record or HTML file)
   4. Submit sitemap: https://stockhive.co.ke/sitemap.xml
   5. Request indexing for homepage
   ```

2. **Google Analytics 4** (Optional but recommended)
   ```
   1. Create GA4 property at https://analytics.google.com
   2. Copy tracking ID (G-XXXXXXXXXX)
   3. Add to landing page <head>:
   
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```

---

## ⚡ Core Web Vitals Optimization

Your landing page is **already optimized** for these Google ranking signals:

| Metric | Target | How We Achieved It |
|--------|--------|-------------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Hero image preloaded, minimal JS |
| **FID/INP** (Interaction) | < 100ms | Plain HTML/CSS, no heavy JS frameworks |
| **CLS** (Layout Shift) | < 0.1 | Explicit image dimensions (`width="600" height="400"`) |
| **Page Size** | < 500KB | Inline CSS (no external stylesheets), compressed images |

**Test performance:**
- [Google PageSpeed Insights](https://pagespeed.web.dev)
- [GTmetrix](https://gtmetrix.com)
- [WebPageTest](https://webpagetest.org)

**Target: 90+ score on all metrics** ✅

---

## 🎯 Target Keywords

Your landing page is optimized for these searches:

### Primary Keywords (High Intent)
- inventory management system Kenya
- stock management app Kenya
- duka stock management software
- wholesale inventory software Kenya
- free inventory management Kenya
- multi-branch inventory system Kenya

### Secondary Keywords (Medium Intent)
- shop inventory tracker Kenya
- inventory app for retail shops Kenya
- stock control system small business Kenya
- biashara stock management

### Long Tail Keywords (Low Competition, High Conversion)
- free stock management app for shops in Kenya
- inventory system for retail and wholesale Kenya
- how to manage shop inventory Kenya
- multi branch shop management system Kenya

---

## 📱 Mobile Optimization

✅ **Already implemented:**
- Responsive design (works on all screen sizes)
- Touch-friendly buttons (48px minimum)
- Mobile-first CSS
- PWA-ready (installable as app)

**Test on mobile:**
```
1. Use Chrome DevTools (F12 → Toggle Device Toolbar)
2. Test on real phone (share link via WhatsApp/email)
3. Use Google's Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
```

---

## 🔒 SSL Certificate (HTTPS)

Both Railway and Netlify provide **free SSL certificates**. Ensure you're using `https://` (not `http://`).

Google penalizes non-HTTPS sites in search rankings. ✅

---

## 📊 Monitoring & Maintenance

### Weekly
- Check Google Search Console for errors
- Monitor traffic in Google Analytics

### Monthly
- Run Lighthouse audit
- Check Core Web Vitals
- Review search console queries

### Quarterly
- Update pricing if needed
- Add testimonials/case studies
- Publish blog posts (v2)

---

## 🚀 Next Steps (After Initial Launch)

1. **Deploy landing page** to Railway/Netlify
2. **Set up SSL** (automatic with both platforms)
3. **Verify in Google Search Console**
4. **Submit sitemap** to Google
5. **Request indexing** for homepage
6. **Wait 1-2 weeks** for Google to crawl and index
7. **Monitor Search Console** for ranking keywords
8. **Add blog** (v2) for long-tail keywords
9. **Build backlinks** (get featured in Kenyan tech blogs)
10. **Optimize based on CTR** (meta descriptions, headlines)

---

## 📈 Expected Results Timeline

| Timeline | Expected Result |
|----------|-----------------|
| **Day 1-7** | Pages added to Google (pending indexation) |
| **Week 2-4** | Start appearing in search results |
| **Month 1-3** | Rank for long-tail keywords (e.g., "free stock management app Kenya") |
| **Month 3-6** | Rank for medium-competition keywords |
| **Month 6+** | Potentially rank for high-value keywords |

---

## 🛠️ Customization Tips

### Change colors to match your brand:
Update `:root` variables in `<style>`:
```css
:root {
  --accent: #your-color; /* Change from #f59e0b */
}
```

### Add social media links:
Add to footer:
```html
<a href="https://twitter.com/stockhive">Twitter</a>
<a href="https://instagram.com/stockhive">Instagram</a>
```

### Add testimonials section:
```html
<section>
  <h2>What Shopkeepers Say</h2>
  <div class="testimonial">
    <p>"StočkHive saved me 2 hours a day." — John, Nairobi</p>
  </div>
</section>
```

---

## 🐛 Troubleshooting

### Images not showing?
- Check image file paths match `<img src="...">`
- Ensure `landing/images/` folder exists
- Use relative paths: `/landing/images/hero.png`

### Meta tags not showing on social media?
- Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Clear cache: `Ctrl+Shift+R` (hard refresh)

### Search console showing errors?
- Check robots.txt is valid: https://stockhive.co.ke/robots.txt
- Verify sitemap: https://stockhive.co.ke/sitemap.xml
- Ensure SSL certificate is installed

### Page slow?
- Compress images further (target: hero < 80KB)
- Use [GTmetrix](https://gtmetrix.com) to identify bottlenecks
- Preload more critical resources

---

## 📚 Additional SEO Resources

- [Google Search Central](https://developers.google.com/search)
- [Yoast SEO Guide](https://yoast.com/seo/)
- [Semrush Blog](https://www.semrush.com/blog/)
- [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo)

---

## ✨ Summary

Your landing page includes:
- ✅ Perfect SEO foundation (meta tags, schema markup, sitemap, robots.txt)
- ✅ Kenya-targeted geo metadata
- ✅ Mobile-responsive design
- ✅ Performance optimized (< 500KB, no heavy JS)
- ✅ Conversion-focused (clear CTAs, social proof, FAQ)
- ✅ Accessible HTML structure

**Ready to deploy!** Pick Railway or Netlify above and start getting organic traffic. 🚀

---

*Built with ❤️ for Kenyan entrepreneurs*
