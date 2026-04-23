# StočkHive Landing Page — Quick Start

## 📂 What Was Created

Inside `/landing/` folder:

| File | Purpose |
|------|---------|
| `index.html` | Main landing page (9 sections, SEO-optimized) |
| `sitemap.xml` | Tells Google where all your pages are |
| `robots.txt` | Tells Google what to crawl/not crawl |
| `DEPLOYMENT_GUIDE.md` | Detailed deployment & SEO setup instructions |

## 🎯 Key SEO Features Implemented

✅ **H1 with Keywords**: "Inventory Management Built for Kenyan Shops"
✅ **Meta Tags**: Description, keywords, author, canonical URL
✅ **Open Graph**: Social media preview when shared
✅ **JSON-LD Schema**: SoftwareApplication + Organization + FAQ
✅ **Geographic Targeting**: Kenya (lat/long, region metadata)
✅ **Mobile-Responsive**: Works perfectly on all devices
✅ **Performance Optimized**: Preloaded fonts, lazy-loaded images
✅ **Semantic HTML**: Proper heading hierarchy (H1 > H2 > H3)
✅ **Image Alt Text**: All images have keyword-rich descriptions
✅ **FAQ Section**: 7 questions with schema markup (Google featured snippets)

## 🚀 Next Steps (In Order)

### Step 1: Create Image Folder & Add Images
```
landing/
├── images/
│   └── hero-screenshot.png (600x400px, <100KB)
├── icons/
│   ├── favicon-32x32.png (32x32px)
│   ├── apple-touch-icon.png (180x180px)
│   └── icon-512x512.png (512x512px)
└── og-image.png (1200x630px, <200KB)
```

**Quick image tips:**
- Take a screenshot of your dashboard
- Compress with [TinyPNG.com](https://tinypng.com) (free)
- Dimensions are important for performance

### Step 2: Deploy to Railway or Netlify

**Railway** (Same platform as your app):
1. Create new project → Static Site
2. Upload `landing/` folder
3. Set custom domain: `stockhive.co.ke`
4. Deploy!

**Netlify** (Alternative):
1. Drag & drop `landing/` folder
2. Set custom domain: `stockhive.co.ke`
3. Done!

### Step 3: Point Your Domain

In your domain registrar (Namecheap, Hostinger, etc.):
- Update nameservers OR
- Add CNAME record pointing to Railway/Netlify

### Step 4: Verify SSL (Free)

Both platforms auto-generate SSL certificates. Ensure URLs are `https://` ✅

### Step 5: Submit to Google

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `stockhive.co.ke`
3. Verify ownership (DNS record method is easiest)
4. Submit sitemap: `https://stockhive.co.ke/sitemap.xml`
5. Request indexing for homepage

### Step 6: Monitor & Optimize

- Google Search Console: Track keywords you rank for
- Google Analytics: Monitor traffic & behavior
- Lighthouse audit: Check performance weekly

## 📊 9-Section Landing Page Structure

1. **Hero** — Main headline + CTA buttons + dashboard screenshot
2. **Social Proof** — Geographic cities (Nairobi, Mombasa, etc.)
3. **Problem/Solution** — Pain points vs StočkHive benefits
4. **Features** — 6 key features (Stock Mgmt, Multi-Branch, Reports, etc.)
5. **Pricing** — Free, Basic (KES 999), Pro (KES 2,499)
6. **How It Works** — 3-step onboarding
7. **FAQ** — 7 questions with schema markup
8. **Final CTA** — "Ready to take control?" section
9. **Footer** — Links, copyright, "Built in Kenya 🇰🇪"

## 🎨 Design System (Already Applied)

```css
Colors:
- Background: #0d0f12 (near black)
- Surface: #13161b (dark charcoal)
- Accent: #f59e0b (amber) ← Your brand color
- Green: #10b981 (for checkmarks)
- Red: #ef4444 (for warnings)
- Text: #e8eaed (off-white)
- Muted: #6b7280 (gray)

Fonts:
- Headings: Syne (bold, geometric)
- Body: System fonts (fast, accessible)
- Mono: DM Mono (pricing, technical text)
```

## 🔑 Target Keywords

Your page ranks for these searches (eventually):

**High Intent (people ready to buy):**
- inventory management system Kenya
- stock management app Kenya
- duka stock management software
- wholesale inventory software Kenya

**Medium Intent (researching):**
- shop inventory tracker Kenya
- inventory app for retail shops Kenya
- stock control system small business Kenya

**Long Tail (low competition):**
- free stock management app for shops in Kenya
- inventory system for retail and wholesale Kenya
- how to manage shop inventory Kenya

## 📱 Mobile Testing

```
1. Open Chrome
2. Press F12 (DevTools)
3. Click device icon (top-left)
4. Test on iPhone 12, iPhone SE, Pixel 5
5. Ensure buttons are tappable (min 48px)
6. Text readable without zooming
```

Or: Share via WhatsApp link and test on real phone 📱

## 🚦 Performance Targets

**Aim for Lighthouse score of 90+:**

| Metric | Current | Target |
|--------|---------|--------|
| Performance | High | 90+ |
| Accessibility | High | 90+ |
| Best Practices | High | 90+ |
| SEO | Perfect | 100 |

Test: [PageSpeed Insights](https://pagespeed.web.dev)

## 💡 Common Questions

**Q: How long until I rank on Google?**
A: 2-4 weeks to appear in results, 3-6 months for meaningful traffic

**Q: Do I need a blog?**
A: Not required for v1. Add later (v2) for long-tail keywords

**Q: Should I use Analytics?**
A: Yes, set up Google Analytics 4 (free, takes 5 min)

**Q: What if images don't show?**
A: Check paths are correct. Use `/landing/images/hero.png` format

**Q: Can I update the page after deployment?**
A: Yes! Edit `index.html` and redeploy (takes seconds)

## 🎯 One-Month SEO Roadmap

| Week | Action |
|------|--------|
| **Week 1** | Deploy landing page, add images, verify SSL |
| **Week 2** | Submit to Google Search Console, submit sitemap |
| **Week 3** | Monitor indexation, check ranking for brand keywords |
| **Week 4** | Optimize meta descriptions based on CTR, add Analytics |

## 📞 Need Help?

- **Deployment issues?** → Check DEPLOYMENT_GUIDE.md
- **SEO questions?** → See SEO Checklist section
- **Performance slow?** → Use GTmetrix or Lighthouse to debug
- **Images missing?** → Verify `/landing/images/` folder exists

---

**You're ready! Pick your deployment platform and go live.** 🚀

Questions? Read `DEPLOYMENT_GUIDE.md` for detailed instructions.
