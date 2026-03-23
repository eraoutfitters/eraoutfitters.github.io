// ─── HERO MEDIA ROTATOR ──────────────────────
fetch('media-config.json')
  .then(function(r) { return r.json(); })
  .then(function(ALL_MEDIA) {
(function (ALL_MEDIA) {
  var isMobile = window.matchMedia('(max-width: 768px)').matches;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var slowConn = conn && (
    conn.saveData === true ||
    conn.effectiveType === 'slow-2g' ||
    conn.effectiveType === '2g'
  );
  var videosAllowed = !slowConn;

  var media = videosAllowed
    ? ALL_MEDIA
    : ALL_MEDIA.filter(function (m) { return m.type === 'image'; });

  if (!media.length) return;

  var container = document.getElementById('hero-media');
  var FADE         = 1200;
  var IMG_HOLD     = 5000;
  var VIDEO_SKIP   = 3000;
  var cur          = 0;
  var imgTimer     = null;
  var skipTimer    = null;
  var els          = [];

  function makeVideoEl(src, cls) {
    var v = document.createElement('video');
    v.muted       = true;
    v.autoplay    = true;
    v.loop        = false;
    v.playsInline = true;
    v.controls    = false;
    v.preload     = 'metadata';
    v.setAttribute('muted', '');
    v.setAttribute('autoplay', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('x5-playsinline', '');
    v.setAttribute('x5-video-player-type', 'h5');
    v.setAttribute('disableremoteplayback', '');
    v.className = cls;
    v.src       = src;
    return v;
  }

  media.forEach(function (m) {
    var el;
    if (m.type === 'video') {
      el = document.createElement('div');
      el.className = 'hero-media-item is-video';
      var videoMain = makeVideoEl(m.src, 'vp-main');
      el.appendChild(videoMain);
      var videoBlur = null;
      if (isMobile) {
        videoBlur = makeVideoEl(m.src, 'vp-blur');
        el.appendChild(videoBlur);
      }
      container.appendChild(el);
      els.push({ el: el, videoMain: videoMain, videoBlur: videoBlur, type: 'video' });
    } else {
      el = document.createElement('div');
      el.className = 'hero-media-item is-image';
      el.style.backgroundImage = "url('" + m.src + "')";
      container.appendChild(el);
      els.push({ el: el, type: 'image' });
    }
  });

  els.forEach(function (item, i) {
    if (item.type !== 'video') return;
    item.videoMain.addEventListener('ended', function () {
      if (cur === i) goTo(i + 1);
    });
    item.videoMain.addEventListener('playing', function () {
      clearTimeout(skipTimer);
    });
  });

  function playVideo(item, onFail) {
    clearTimeout(skipTimer);
    item.videoMain.currentTime = 0;
    if (item.videoBlur) item.videoBlur.currentTime = 0;
    skipTimer = setTimeout(function () {
      if (item.videoMain.paused || item.videoMain.readyState < 2) {
        item.videoMain.pause();
        if (item.videoBlur) item.videoBlur.pause();
        onFail();
      }
    }, VIDEO_SKIP);
    var p = item.videoMain.play();
    if (item.videoBlur) item.videoBlur.play().catch(function () {});
    if (p && typeof p.then === 'function') {
      p.then(function () { clearTimeout(skipTimer); })
       .catch(function () { clearTimeout(skipTimer); onFail(); });
    }
  }

  function goTo(idx) {
    var prevIdx = cur;
    cur = ((idx % els.length) + els.length) % els.length;
    clearTimeout(imgTimer);
    clearTimeout(skipTimer);
    var next = els[cur];
    var prev = els[prevIdx];
    next.el.style.zIndex  = '3';
    void next.el.offsetWidth;
    next.el.style.opacity = '1';
    setTimeout(function () {
      if (prev.type === 'video') {
        prev.videoMain.pause();
        if (prev.videoBlur) prev.videoBlur.pause();
      }
      prev.el.style.opacity = '0';
      prev.el.style.zIndex  = '1';
      next.el.style.zIndex  = '2';
    }, FADE);
    if (next.type === 'video') {
      playVideo(next, function () { imgTimer = setTimeout(function () { goTo(cur + 1); }, 0); });
    } else {
      imgTimer = setTimeout(function () { goTo(cur + 1); }, IMG_HOLD);
    }
  }

  var first = els[0];
  first.el.style.zIndex  = '2';
  first.el.style.opacity = '1';
  if (first.type === 'video') {
    playVideo(first, function () { imgTimer = setTimeout(function () { goTo(1); }, 0); });
  } else {
    imgTimer = setTimeout(function () { goTo(1); }, IMG_HOLD);
  }

  window.heroNav = function(dir) { goTo(cur + dir); };
}(ALL_MEDIA));
  }).catch(function() { console.warn('media-config.json not found'); });

// ─── SCROLL REVEAL ────────────────────────────
var reveals = document.querySelectorAll('.reveal');
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: 0.12 });
reveals.forEach(function(el) { observer.observe(el); });

// ─── SHOP — Storefront API ────────────────────
var SHOP_DOMAIN   = 'mddjp6-nx.myshopify.com';
var SHOP_TOKEN    = 'b306f8e1668b7a20ecdc465faf332c76';
var SHOP_API      = 'https://' + SHOP_DOMAIN + '/api/2024-01/graphql.json';
var _shopLoaded   = false;
var _shopProducts = [];
var _selectedVariants = {};
var _renderedCards    = [];
var _shopScrollY      = 0; // saves scroll position before entering detail
var _cart = []; // { variantId, qty, productIdx, title, color, size, price, currency, imgUrl, freeGift? }

// ─── FREE KOOZIE GLOBALS ──────────────────────
var _koozieVariantId = null;
var _koozieImgUrl    = '';
var _koozieName      = 'Erä Can Cooler';
var _kooziePrice     = 0;
var _koozieCurrency  = 'USD';
var KOOZIE_THRESHOLD = 25;

function getColorSwatches(p) {
  var seen = {}, swatches = [];
  ((p.variants && p.variants.edges) || []).forEach(function(e) {
    var colorOpt = e.node.selectedOptions.find(function(so) { return so.name.toLowerCase() === 'color'; });
    if (colorOpt && !seen[colorOpt.value]) {
      seen[colorOpt.value] = true;
      swatches.push({ colorVal: colorOpt.value, imgUrl: e.node.image ? e.node.image.url : '' });
    }
  });
  return swatches;
}

function gql(query, variables) {
  return fetch(SHOP_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOP_TOKEN
    },
    body: JSON.stringify({ query: query, variables: variables || {} })
  }).then(function(r) { return r.json(); });
}

var PRODUCTS_QUERY = [
  'query {',
  '  products(first: 24) {',
  '    edges {',
  '      node {',
  '        id title descriptionHtml productType',
  '        images(first: 5) { edges { node { url altText } } }',
  '        variants(first: 30) {',
  '          edges {',
  '            node {',
  '              id title availableForSale',
  '              price { amount currencyCode }',
  '              selectedOptions { name value }',
  '              image { url altText }',
  '            }',
  '          }',
  '        }',
  '        options { name values }',
  '      }',
  '    }',
  '  }',
  '}'
].join('\n');

var CART_CREATE_QUERY = [
  'mutation cartCreate($lines: [CartLineInput!]!) {',
  '  cartCreate(input: { lines: $lines }) {',
  '    cart { checkoutUrl }',
  '    userErrors { field message }',
  '  }',
  '}'
].join('\n');

function openShopModal() {
  loadShopProducts();
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

function closeShop() {}

// Auto-load products when shop section scrolls into view
(function() {
  var shopEl = document.getElementById('shop');
  if (!shopEl) return;
  var obs = new IntersectionObserver(function(entries, o) {
    if (entries[0].isIntersecting) { loadShopProducts(); o.disconnect(); }
  }, { threshold: 0.05 });
  obs.observe(shopEl);
}());

// ─── SKELETON LOADING ─────────────────────────
function renderSkeletons(n) {
  var html = '<p class="shop-row-label" aria-hidden="true">&nbsp;</p>'
           + '<div class="grid-scroll-wrap"><div class="product-grid">';
  for (var i = 0; i < n; i++) {
    html += '<div class="product-card product-card--skeleton" aria-hidden="true">'
          + '<div class="card-img-wrap skeleton-pulse"></div>'
          + '<div class="skeleton-line" style="width:75%;margin-top:14px"></div>'
          + '<div class="skeleton-line" style="width:45%;margin-top:8px"></div>'
          + '<div class="skeleton-line" style="width:35%;margin-top:8px"></div>'
          + '</div>';
  }
  html += '</div></div>';
  return html;
}

function loadShopProducts() {
  if (_shopLoaded) return;
  var grid = document.getElementById('shopGrid');
  grid.innerHTML = renderSkeletons(6);
  gql(PRODUCTS_QUERY).then(function(data) {
    _shopLoaded = true;
    var edges = (data.data && data.data.products && data.data.products.edges) || [];
    _shopProducts = edges.map(function(e) { return e.node; });
    renderProductGrid();
  }).catch(function() {
    document.getElementById('shopGrid').innerHTML = '<p class="shop-loading">Unable to load products.</p>';
  });
}

function renderProductGrid() {
  var grid = document.getElementById('shopGrid');
  if (!_shopProducts.length) {
    grid.innerHTML = '<p class="shop-loading">No products found.</p>';
    return;
  }

  var productSwatches = _shopProducts.map(function(p, i) {
    var sw = getColorSwatches(p);
    return { productIdx: i, swatches: sw.length ? sw : [null] };
  });

  // One card per product (first color swatch as default)
  var allCards = [];
  productSwatches.forEach(function(ps) {
    var firstSw = ps.swatches[0];
    allCards.push({ productIdx: ps.productIdx, activeColorVal: firstSw ? firstSw.colorVal : null });
  });

  // Pin specific products to the front by title
  var pinnedTitles = [
    'Original Erä Outfitters Long Sleeve Comfort Colors Shirt',
    'Original Erä Outfitters Comfort Colors Shirt'
  ];
  var pinnedCards = [], rest = [];
  allCards.forEach(function(c) {
    var p = _shopProducts[c.productIdx];
    var pinIdx = pinnedTitles.indexOf(p.title);
    if (pinIdx !== -1 && !pinnedCards[pinIdx]) pinnedCards[pinIdx] = c;
    else rest.push(c);
  });
  for (var i = rest.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
  }
  _renderedCards = pinnedCards.filter(Boolean).concat(rest);

  function isAccessory(card) {
    var p = _shopProducts[card.productIdx];
    var pt = (p.productType || '').toLowerCase();
    var title = (p.title || '').toLowerCase();
    return title.indexOf('koozie') !== -1 || title.indexOf('sticker') !== -1 ||
           pt.indexOf('accessory') !== -1 || pt.indexOf('accessories') !== -1 ||
           pt.indexOf('drinkware') !== -1;
  }
  function isHat(card) {
    var pt = (_shopProducts[card.productIdx].productType || '').toLowerCase();
    var title = (_shopProducts[card.productIdx].title || '').toLowerCase();
    return pt.indexOf('hat') !== -1 || pt.indexOf('cap') !== -1 || pt.indexOf('beanie') !== -1 ||
           title.indexOf('hat') !== -1 || title.indexOf('cap') !== -1 || title.indexOf('beanie') !== -1;
  }
  var accessoryCards = _renderedCards.filter(function(c) { return isAccessory(c); });
  var hatCards   = _renderedCards.filter(function(c) { return !isAccessory(c) && isHat(c); });
  var shirtCards = _renderedCards.filter(function(c) { return !isAccessory(c) && !isHat(c); });

  function buildRow(cards, rowId) {
    var rowHtml = '<div class="grid-scroll-wrap"><div class="product-grid" id="' + rowId + '">';
    cards.forEach(function(card) {
      var ci = _renderedCards.indexOf(card);
      var p = _shopProducts[card.productIdx];
      var vEdges = (p.variants && p.variants.edges) || [];
      var swatches = getColorSwatches(p);
      var activeColorVal = card.activeColorVal;

      var activeSw = swatches.find(function(sw) { return sw.colorVal === activeColorVal; });
      var imgNodes = (p.images && p.images.edges || []).map(function(e) { return e.node; });
      var imgUrl = (activeSw && activeSw.imgUrl) ? escAttr(activeSw.imgUrl) : (imgNodes.length ? escAttr(imgNodes[0].url) : '');
      var imgAlt = escAttr((activeColorVal ? activeColorVal + ' ' : '') + p.title);

      var colorVariant = activeColorVal ? vEdges.find(function(e2) {
        return e2.node.selectedOptions.some(function(so) { return so.name.toLowerCase() === 'color' && so.value === activeColorVal; });
      }) : null;
      var price = (colorVariant || vEdges[0]) ? formatMoney(parseFloat((colorVariant || vEdges[0]).node.price.amount), (colorVariant || vEdges[0]).node.price.currencyCode) : '';

      var cardAriaLabel = escAttr(p.title + (activeColorVal ? ', ' + activeColorVal : '') + (price ? ', ' + price : ''));
      var cardOnclick = 'showProductDetailFromCard(' + ci + ')';

      rowHtml += '<div class="product-card" id="pcard-' + ci + '"'
              + ' role="button" tabindex="0" aria-label="' + cardAriaLabel + '"'
              + ' onclick="' + cardOnclick + '"'
              + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' + cardOnclick + '}">';
      rowHtml += '<div class="card-img-wrap">';
      rowHtml += imgUrl ? '<img class="product-card-img" src="' + imgUrl + '" alt="' + imgAlt + '" loading="lazy">' : '<div class="product-card-img"></div>';
      rowHtml += '</div>';

      if (swatches.length > 1) {
        rowHtml += '<div class="card-swatches" onclick="event.stopPropagation()" role="group" aria-label="Color options">';
        swatches.forEach(function(sw) {
          var isActive = sw.colorVal === activeColorVal;
          var bgStyle = sw.imgUrl ? 'background-image:url(' + escAttr(sw.imgUrl) + ');background-size:cover;' : 'background:#ccc;';
          var swOnclick = 'switchCardColor(' + ci + ',' + escAttr(JSON.stringify(sw.colorVal)) + ',event)';
          rowHtml += '<div class="card-swatch' + (isActive ? ' active' : '') + '"'
                  + ' style="' + bgStyle + '"'
                  + ' role="button" tabindex="0"'
                  + ' title="' + escAttr(sw.colorVal) + '"'
                  + ' aria-label="' + escAttr(sw.colorVal + (isActive ? ' (selected)' : '')) + '"'
                  + ' onclick="' + swOnclick + '"'
                  + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' + swOnclick + '}">'
                  + '</div>';
        });
        rowHtml += '</div>';
      } else {
        rowHtml += '<div class="card-swatches"></div>';
      }

      rowHtml += '<div class="product-card-title">' + escHtml(p.title) + '</div>';
      if (activeColorVal) rowHtml += '<div class="product-card-color">' + escHtml(activeColorVal) + '</div>';
      if (price) rowHtml += '<div class="product-card-price">' + escHtml(price) + '</div>';

      // Quick Add — color is read live from _renderedCards[ci] at click time, not baked in
      rowHtml += '<div class="card-quick-add" onclick="event.stopPropagation()">';
      rowHtml += '<button class="quick-add-btn" id="qa-btn-' + ci + '" onclick="quickAddClick(event,' + ci + ')">Quick Add</button>';
      rowHtml += '<div class="card-size-picker" id="qa-sizes-' + ci + '"></div>';
      rowHtml += '</div>';

      rowHtml += '</div>';
    });
    rowHtml += '</div>';
    rowHtml += '<div class="grid-scroll-btns">'
             + '<button class="grid-scroll-btn" onclick="scrollGrid(\'' + rowId + '\',-1)" aria-label="Scroll left">&#8592;</button>'
             + '<button class="grid-scroll-btn" onclick="scrollGrid(\'' + rowId + '\',1)" aria-label="Scroll right">&#8594;</button>'
             + '</div>';
    rowHtml += '</div>';
    return rowHtml;
  }

  var html = '';
  if (shirtCards.length) {
    html += '<p class="shop-row-label">Shirts</p>';
    html += buildRow(shirtCards, 'productScrollRow');
  }
  if (hatCards.length) {
    html += '<p class="shop-row-label">Hats</p>';
    html += buildRow(hatCards, 'productScrollRowHats');
  }
  if (accessoryCards.length) {
    html += '<p class="shop-row-label">Accessories</p>';
    html += buildRow(accessoryCards, 'productScrollRowAccessories');
  }
  grid.innerHTML = html;
  document.getElementById('shopGrid').style.display   = 'block';
  document.getElementById('shopDetail').style.display = 'none';
}

function switchCardColor(ci, colorVal, e) {
  e.stopPropagation();
  _renderedCards[ci].activeColorVal = colorVal;
  var p = _shopProducts[_renderedCards[ci].productIdx];
  var swatches = getColorSwatches(p);
  var sw = swatches.find(function(s) { return s.colorVal === colorVal; });
  var card = document.getElementById('pcard-' + ci);
  if (!card) return;
  var img = card.querySelector('.product-card-img');
  if (img && sw && sw.imgUrl) { img.src = sw.imgUrl; img.alt = colorVal; }
  card.querySelectorAll('.card-swatch').forEach(function(dot) {
    var isNowActive = dot.title === colorVal;
    dot.classList.toggle('active', isNowActive);
    dot.setAttribute('aria-label', dot.title + (isNowActive ? ' (selected)' : ''));
  });
  var colorLabel = card.querySelector('.product-card-color');
  if (colorLabel) colorLabel.textContent = colorVal;
  // Update card aria-label
  card.setAttribute('aria-label', escAttr(p.title + ', ' + colorVal));
}

function showProductDetailFromCard(ci) {
  var card = _renderedCards[ci];
  if (!card) return;
  showProductDetail(card.productIdx, card.activeColorVal);
}

function scrollGrid(rowId, dir) {
  var row = document.getElementById(rowId);
  if (!row) return;
  var cardEl = row.querySelector('.product-card');
  var step = cardEl ? cardEl.offsetWidth + 20 : 280;
  row.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
}

function showShopGrid() {
  document.getElementById('shopGrid').style.display   = 'block';
  document.getElementById('shopDetail').style.display = 'none';
  // Restore exact scroll position instead of jumping to section top
  window.scrollTo({ top: _shopScrollY, behavior: 'instant' });
}

function showProductDetail(idx, colorVal) {
  _shopScrollY = window.scrollY; // save before hiding grid
  var p = _shopProducts[idx];
  if (!p) return;

  var vEdges = (p.variants && p.variants.edges) || [];
  if (colorVal) {
    // If there's already a selected variant that matches this color (e.g. from quick-add size
    // selection), keep it so the size stays pre-selected. Only override when the current
    // variant is a different color.
    var currentVar = vEdges.find(function(e) { return e.node.id === _selectedVariants[idx]; });
    var colorAlreadyMatches = currentVar && currentVar.node.selectedOptions.some(function(so) {
      return so.name.toLowerCase() === 'color' && so.value === colorVal;
    });
    if (!colorAlreadyMatches) {
      var matchVariant = vEdges.find(function(e) {
        return e.node.selectedOptions.some(function(so) {
          return so.name.toLowerCase() === 'color' && so.value === colorVal;
        });
      });
      if (matchVariant) _selectedVariants[idx] = matchVariant.node.id;
    }
  } else if (!_selectedVariants[idx] && vEdges.length) {
    _selectedVariants[idx] = vEdges[0].node.id;
  }

  document.getElementById('shopGrid').style.display   = 'none';
  document.getElementById('shopDetail').style.display = 'block';
  renderDetail(idx);
  // Scroll to top of shop section
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

function renderDetail(idx) {
  var p = _shopProducts[idx];
  var vEdges = (p.variants && p.variants.edges) || [];
  var selId  = _selectedVariants[idx] || (vEdges.length ? vEdges[0].node.id : null);
  var selVar = vEdges.find(function(e) { return e.node.id === selId; });
  if (!selVar && vEdges.length) selVar = vEdges[0];

  var imgEdges = (p.images && p.images.edges) || [];
  var imgs = imgEdges.map(function(e) { return e.node; });
  var variantImg = selVar && selVar.node.image;

  var price = selVar ? formatMoney(parseFloat(selVar.node.price.amount), selVar.node.price.currencyCode) : '';
  var avail = selVar ? selVar.node.availableForSale : false;

  // Build options UI with per-option availability
  var optionsHtml = '';
  (p.options || []).forEach(function(opt) {
    if (opt.values.length === 1 && opt.name === 'Title') return;
    optionsHtml += '<div class="detail-option-label" id="opt-label-' + escAttr(opt.name) + '">' + escHtml(opt.name) + '</div>';
    optionsHtml += '<div class="option-btns" role="group" aria-labelledby="opt-label-' + escAttr(opt.name) + '">';

    var sizeOrder = ['XS','S','SM','S/M','SMALL','M','MD','M/L','MEDIUM','L','LG','LARGE','XL','1X','2X','XXL','2XL','3X','XXXL','3XL','4XL'];
    var sortedVals = opt.values.slice().sort(function(a, b) {
      var ai = sizeOrder.indexOf(a.toUpperCase());
      var bi = sizeOrder.indexOf(b.toUpperCase());
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    sortedVals.forEach(function(val) {
      var isSelected = selVar && selVar.node.selectedOptions.some(function(so) {
        return so.name === opt.name && so.value === val;
      });

      // Check stock for this option value with the currently selected other options
      var testOpts = {};
      if (selVar) {
        selVar.node.selectedOptions.forEach(function(so) { testOpts[so.name] = so.value; });
      }
      testOpts[opt.name] = val;
      var matchV = vEdges.find(function(e) {
        return e.node.selectedOptions.every(function(so) { return testOpts[so.name] === so.value; });
      });
      var isAvail = matchV ? matchV.node.availableForSale : false;

      optionsHtml += '<button class="option-btn'
                   + (isSelected ? ' selected' : '')
                   + (isAvail ? '' : ' sold-out') + '"'
                   + ' aria-label="' + escAttr(opt.name + ' ' + val + (isAvail ? '' : ', sold out')) + '"'
                   + ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"'
                   + ' onclick="selectOption(' + idx + ',' + escAttr(JSON.stringify(opt.name)) + ',' + escAttr(JSON.stringify(val)) + ')">'
                   + escHtml(val)
                   + '</button>';
    });
    optionsHtml += '</div>';
  });

  var mainImgNode = (variantImg && variantImg.url) ? variantImg : (imgs.length ? imgs[0] : null);
  var mainImgSrc = mainImgNode ? escAttr(mainImgNode.url) : '';
  var mainImgAlt = mainImgNode ? escAttr(mainImgNode.altText || p.title) : '';

  var thumbsHtml = '';
  if (imgs.length > 1) {
    imgs.forEach(function(img, ti) {
      var isActive = mainImgNode && img.url === mainImgNode.url;
      thumbsHtml += '<img class="detail-thumb' + (isActive ? ' active' : '') + '"'
                 + ' src="' + escAttr(img.url) + '"'
                 + ' alt="' + escAttr(img.altText || p.title + ' view ' + (ti + 1)) + '"'
                 + ' onclick="switchDetailImage(' + idx + ',' + ti + ')"'
                 + ' loading="lazy">';
    });
  }

  var atcLabel = avail ? 'Add to Cart' : 'Sold Out';
  var atcDisabled = avail ? '' : ' disabled';

  var html = '<div class="detail-layout">';
  html += '<div class="detail-images">';
  if (mainImgSrc) {
    html += '<img id="detailMainImg" class="detail-main-img" src="' + mainImgSrc + '" alt="' + mainImgAlt + '"'
         + ' onclick="openImageZoom(this.src,this.alt)" title="Click to zoom" style="cursor:zoom-in">';
  } else {
    html += '<div id="detailMainImg" class="detail-main-img"></div>';
  }
  if (thumbsHtml) html += '<div class="detail-thumbs" id="detailThumbs">' + thumbsHtml + '</div>';
  html += '</div>';
  html += '<div class="detail-info">';
  html += '<div class="detail-title">' + escHtml(p.title) + '</div>';
  if (price) html += '<div class="detail-price">' + escHtml(price) + '</div>';
  html += optionsHtml;
  if (p.descriptionHtml) html += '<div class="detail-desc">' + p.descriptionHtml + '</div>';
  html += '<button class="detail-atc-btn"' + atcDisabled + ' aria-label="' + escAttr(atcLabel + ' — ' + p.title) + '" onclick="addToCart(' + idx + ')">' + atcLabel + '</button>';
  html += '</div></div>';

  document.getElementById('shopDetailContent').innerHTML = html;
}

function selectOption(idx, optName, optVal) {
  var p = _shopProducts[idx];
  var vEdges = (p.variants && p.variants.edges) || [];
  var selVar = vEdges.find(function(e) { return e.node.id === _selectedVariants[idx]; });

  var currentOpts = {};
  if (selVar) {
    selVar.node.selectedOptions.forEach(function(so) { currentOpts[so.name] = so.value; });
  }
  currentOpts[optName] = optVal;

  var match = vEdges.find(function(e) {
    return e.node.selectedOptions.every(function(so) { return currentOpts[so.name] === so.value; });
  });
  if (match) _selectedVariants[idx] = match.node.id;
  renderDetail(idx);
}

function switchDetailImage(idx, ti) {
  var imgs = document.querySelectorAll('.detail-thumb');
  var mainImg = document.getElementById('detailMainImg');
  if (!mainImg || !imgs[ti]) return;
  var clickedSrc = imgs[ti].src;
  var p = _shopProducts[idx];
  if (p) {
    var vEdges = (p.variants && p.variants.edges) || [];
    var matchVariant = vEdges.find(function(e) {
      return e.node.image && e.node.image.url === clickedSrc;
    });
    if (matchVariant) {
      // Preserve current size (and any other non-color options) when switching color via image
      var currentVar = vEdges.find(function(e) { return e.node.id === _selectedVariants[idx]; });
      var newColorOpt = matchVariant.node.selectedOptions.find(function(so) {
        return so.name.toLowerCase() === 'color';
      });
      if (currentVar && newColorOpt) {
        var currentOpts = {};
        currentVar.node.selectedOptions.forEach(function(so) { currentOpts[so.name] = so.value; });
        currentOpts[newColorOpt.name] = newColorOpt.value;
        var bestMatch = vEdges.find(function(e) {
          return e.node.selectedOptions.every(function(so) { return currentOpts[so.name] === so.value; });
        });
        _selectedVariants[idx] = (bestMatch || matchVariant).node.id;
      } else {
        _selectedVariants[idx] = matchVariant.node.id;
      }
      renderDetail(idx);
      return;
    }
  }
  imgs.forEach(function(t) { t.classList.remove('active'); });
  imgs[ti].classList.add('active');
  mainImg.src = clickedSrc;
  mainImg.alt = imgs[ti].alt;
}

function addToCart(idx) {
  var variantId = _selectedVariants[idx];
  if (!variantId) return;
  var p = _shopProducts[idx];
  var vEdges = (p.variants && p.variants.edges) || [];
  var selVar = vEdges.find(function(e) { return e.node.id === variantId; });
  if (!selVar) return;

  var colorOpt = selVar.node.selectedOptions.find(function(so) { return so.name.toLowerCase() === 'color'; });
  var sizeOpt  = selVar.node.selectedOptions.find(function(so) { return so.name.toLowerCase() === 'size'; });
  var color = colorOpt ? colorOpt.value : '';
  var size  = sizeOpt  ? sizeOpt.value  : '';

  // Use variant image, else first product image
  var imgUrl = '';
  if (selVar.node.image && selVar.node.image.url) {
    imgUrl = selVar.node.image.url;
  } else {
    var imgEdges = (p.images && p.images.edges) || [];
    if (imgEdges.length) imgUrl = imgEdges[0].node.url;
  }

  var price    = parseFloat(selVar.node.price.amount);
  var currency = selVar.node.price.currencyCode;

  // Increment qty if already in cart, else push new item
  var existing = _cart.find(function(item) { return item.variantId === variantId; });
  if (existing) {
    existing.qty++;
  } else {
    _cart.push({ variantId: variantId, qty: 1, productIdx: idx,
                 title: p.title, color: color, size: size,
                 price: price, currency: currency, imgUrl: imgUrl });
  }

  updateCartBadge();

  // Brief button feedback
  var btn = document.querySelector('.detail-atc-btn');
  if (btn) {
    btn.textContent = 'Added \u2713';
    btn.disabled = true;
    setTimeout(function() {
      btn.textContent = 'Add to Cart';
      btn.disabled = false;
    }, 1400);
  }

  openCart();
}

// ─── QUICK ADD ────────────────────────────────
// Always read the live color from _renderedCards[ci] — never bake it into onclick strings.
function quickAddClick(e, ci) {
  e.stopPropagation();
  var cardData = _renderedCards[ci];
  if (!cardData) return;
  var productIdx    = cardData.productIdx;
  var activeColor   = cardData.activeColorVal;   // live value, reflects swatch switches
  var p             = _shopProducts[productIdx];
  var vEdges        = (p.variants && p.variants.edges) || [];

  // Compute sizes available for the current color right now
  var sizeOpt = p.options && p.options.find(function(o) { return o.name.toLowerCase() === 'size'; });
  var availSizes = [];
  if (sizeOpt && sizeOpt.values) {
    availSizes = sizeOpt.values.filter(function(sv) {
      return vEdges.some(function(ve) {
        var matchColor = !activeColor || ve.node.selectedOptions.some(function(so) {
          return so.name.toLowerCase() === 'color' && so.value === activeColor;
        });
        var matchSize = ve.node.selectedOptions.some(function(so) {
          return so.name.toLowerCase() === 'size' && so.value === sv;
        });
        return matchColor && matchSize && ve.node.availableForSale;
      });
    });
  }

  var sizeOrder = ['XXS','XS','S','M','L','XL','XXL','XXXL','3XL','4XL','OS','ONE SIZE'];
  availSizes.sort(function(a, b) {
    var ai = sizeOrder.indexOf(a.toUpperCase());
    var bi = sizeOrder.indexOf(b.toUpperCase());
    if (ai === -1) ai = sizeOrder.length;
    if (bi === -1) bi = sizeOrder.length;
    return ai - bi;
  });

  if (availSizes.length <= 1) {
    quickAddDirect(ci, availSizes.length === 1 ? availSizes[0] : null);
    return;
  }

  // Build picker fresh (correct sizes for current color) then toggle
  var picker = document.getElementById('qa-sizes-' + ci);
  if (!picker) return;
  var isOpen = picker.classList.contains('open');
  document.querySelectorAll('.card-size-picker.open').forEach(function(el) { el.classList.remove('open'); });
  if (!isOpen) {
    picker.innerHTML = availSizes.map(function(sv) {
      return '<button class="size-pill" onclick="quickAddSize(event,' + ci + ',' + escAttr(JSON.stringify(sv)) + ')">' + escHtml(sv) + '</button>';
    }).join('');
    picker.classList.add('open');
  }
}

function quickAddSize(e, ci, sizeVal) {
  e.stopPropagation();
  quickAddDirect(ci, sizeVal);
  var picker = document.getElementById('qa-sizes-' + ci);
  if (picker) picker.classList.remove('open');
}

function quickAddDirect(ci, sizeVal) {
  var cardData = _renderedCards[ci];
  if (!cardData) return;
  var productIdx  = cardData.productIdx;
  var activeColor = cardData.activeColorVal;   // always the live swatch color
  var p           = _shopProducts[productIdx];
  var vEdges      = (p.variants && p.variants.edges) || [];

  var selVar = vEdges.find(function(ve) {
    var matchColor = !activeColor || ve.node.selectedOptions.some(function(so) {
      return so.name.toLowerCase() === 'color' && so.value === activeColor;
    });
    var matchSize = !sizeVal || ve.node.selectedOptions.some(function(so) {
      return so.name.toLowerCase() === 'size' && so.value === sizeVal;
    });
    return matchColor && matchSize;
  });
  // Fallback: first variant matching color
  if (!selVar) selVar = vEdges.find(function(ve) {
    return !activeColor || ve.node.selectedOptions.some(function(so) {
      return so.name.toLowerCase() === 'color' && so.value === activeColor;
    });
  });
  if (!selVar) return;

  var variantId = selVar.node.id;
  // Store so that clicking into the product detail page pre-selects this exact color+size
  _selectedVariants[productIdx] = variantId;
  var colorOpt  = selVar.node.selectedOptions.find(function(so) { return so.name.toLowerCase() === 'color'; });
  var sizeOpt2  = selVar.node.selectedOptions.find(function(so) { return so.name.toLowerCase() === 'size'; });
  var color = colorOpt ? colorOpt.value : '';
  var size  = sizeOpt2  ? sizeOpt2.value  : '';

  var imgUrl = '';
  if (selVar.node.image && selVar.node.image.url) {
    imgUrl = selVar.node.image.url;
  } else {
    var imgEdges = (p.images && p.images.edges) || [];
    if (imgEdges.length) imgUrl = imgEdges[0].node.url;
  }
  var price    = parseFloat(selVar.node.price.amount);
  var currency = selVar.node.price.currencyCode;

  var existing = _cart.find(function(item) { return item.variantId === variantId; });
  if (existing) {
    existing.qty++;
  } else {
    _cart.push({ variantId: variantId, qty: 1, productIdx: productIdx,
                 title: p.title, color: color, size: size,
                 price: price, currency: currency, imgUrl: imgUrl });
  }
  updateCartBadge();

  var btn = document.getElementById('qa-btn-' + ci);
  if (btn) {
    btn.textContent = 'Added \u2713';
    btn.classList.add('added');
    setTimeout(function() { btn.textContent = 'Quick Add'; btn.classList.remove('added'); }, 1400);
  }
  openCart();
}

// ─── CART ─────────────────────────────────────
function openCart() {
  renderCartDrawer();
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function updateCartBadge() {
  var total = _cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
  var badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

function removeCartItem(variantId) {
  var item = _cart.find(function(i) { return i.variantId === variantId; });
  if (item && item.freeGift) return;
  _cart = _cart.filter(function(item) { return item.variantId !== variantId; });
  updateCartBadge();
  renderCartDrawer();
}

function updateCartQty(variantId, delta) {
  var item = _cart.find(function(i) { return i.variantId === variantId; });
  if (!item || item.freeGift) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) {
    _cart = _cart.filter(function(i) { return i.variantId !== variantId; });
  }
  updateCartBadge();
  renderCartDrawer();
}

function syncFreeKoozie() {
  if (!_koozieVariantId) return;
  var subtotal = _cart.reduce(function(sum, item) {
    return item.freeGift ? sum : sum + item.price * item.qty;
  }, 0);
  var hasKoozie = _cart.some(function(i) { return i.freeGift; });
  if (subtotal >= KOOZIE_THRESHOLD && !hasKoozie) {
    _cart.push({ variantId: _koozieVariantId, qty: 1, productIdx: -1,
                 title: _koozieName, color: '', size: '',
                 price: _kooziePrice, currency: _koozieCurrency,
                 imgUrl: _koozieImgUrl, freeGift: true });
    updateCartBadge();
  } else if (subtotal < KOOZIE_THRESHOLD && hasKoozie) {
    _cart = _cart.filter(function(i) { return !i.freeGift; });
    updateCartBadge();
  }
}

function renderCartDrawer() {
  syncFreeKoozie();

  var itemsEl  = document.getElementById('cartItems');
  var footerEl = document.getElementById('cartFooter');
  if (!itemsEl || !footerEl) return;

  if (!_cart.length) {
    itemsEl.innerHTML  = '<div class="cart-empty">Your cart is empty.<br>Browse the collection to add items.</div>';
    footerEl.innerHTML = '';
    return;
  }

  var html = '';
  _cart.forEach(function(item) {
    var metaParts = [];
    if (item.color) metaParts.push(item.color);
    if (item.size)  metaParts.push(item.size);
    var meta = metaParts.join(' \u00B7 ');
    var vid  = escAttr(JSON.stringify(item.variantId));

    if (item.freeGift) {
      html += '<div class="cart-item cart-item--free">';
      if (item.imgUrl) {
        html += '<img class="cart-item-img" src="' + escAttr(item.imgUrl) + '" alt="' + escAttr(item.title) + '" loading="lazy">';
      } else {
        html += '<div class="cart-item-img"></div>';
      }
      html += '<div class="cart-item-info">';
      html += '<div class="cart-item-name">' + escHtml(item.title) + '</div>';
      if (meta) html += '<div class="cart-item-meta">' + escHtml(meta) + '</div>';
      html += '<div class="cart-item-bottom">';
      html += '<span class="cart-item-free-badge">🎁 FREE</span>';
      html += '</div></div></div>';
    } else {
      var linePrice = formatMoney(item.price * item.qty, item.currency);
      html += '<div class="cart-item">';
      if (item.imgUrl) {
        html += '<img class="cart-item-img" src="' + escAttr(item.imgUrl) + '" alt="' + escAttr(item.title) + '" loading="lazy">';
      } else {
        html += '<div class="cart-item-img"></div>';
      }
      html += '<div class="cart-item-info">';
      html += '<div class="cart-item-name">' + escHtml(item.title) + '</div>';
      if (meta) html += '<div class="cart-item-meta">' + escHtml(meta) + '</div>';
      html += '<div class="cart-item-bottom">';
      html += '<div class="cart-qty">'
            + '<button class="cart-qty-btn" onclick="updateCartQty(' + vid + ',-1)" aria-label="Decrease quantity">&#8722;</button>'
            + '<span class="cart-qty-num">' + item.qty + '</span>'
            + '<button class="cart-qty-btn" onclick="updateCartQty(' + vid + ',1)" aria-label="Increase quantity">+</button>'
            + '</div>';
      html += '<span class="cart-item-price">' + escHtml(linePrice) + '</span>';
      html += '</div></div>';
      html += '<button class="cart-item-remove" onclick="removeCartItem(' + vid + ')" aria-label="Remove ' + escAttr(item.title) + ' from cart">&#10005;</button>';
      html += '</div>';
    }
  });
  itemsEl.innerHTML = html;

  var subtotal = _cart.reduce(function(sum, item) { return item.freeGift ? sum : sum + item.price * item.qty; }, 0);
  var currency = (_cart.find(function(i) { return !i.freeGift; }) || _cart[0]).currency;
  var remaining = Math.max(0, KOOZIE_THRESHOLD - subtotal);
  var pct = Math.min(100, Math.round((subtotal / KOOZIE_THRESHOLD) * 100));
  var promoHtml;
  if (remaining > 0) {
    promoHtml = '<div class="koozie-promo">'
      + '<div class="koozie-promo-msg">Add <strong>' + escHtml(formatMoney(remaining, currency)) + ' more</strong> for a <strong>free koozie</strong>! 🧊</div>'
      + '<div class="koozie-promo-bar"><div class="koozie-promo-fill" style="width:' + pct + '%"></div></div>'
      + '</div>';
  } else {
    var koozieInCart = _cart.some(function(i) { return i.freeGift; });
    promoHtml = '<div class="koozie-promo koozie-promo--unlocked">'
      + (koozieInCart ? '🎉 <strong>Free koozie added to your cart!</strong>' : '🎉 You\'ve unlocked a <strong>free koozie</strong>! It\'ll be added at checkout.')
      + '</div>';
  }
  footerEl.innerHTML =
    '<div class="cart-subtotal">'
    + '<span class="cart-subtotal-label">Subtotal</span>'
    + '<span class="cart-subtotal-price">' + escHtml(formatMoney(subtotal, currency)) + '</span>'
    + '</div>'
    + promoHtml
    + '<button class="cart-checkout-btn" id="cartCheckoutBtn" onclick="checkout()">Checkout</button>';
}

function checkout() {
  if (!_cart.length) return;
  var btn = document.getElementById('cartCheckoutBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading\u2026'; }
  var lines = _cart.map(function(item) {
    return { merchandiseId: item.variantId, quantity: item.qty };
  });
  gql(CART_CREATE_QUERY, { lines: lines })
    .then(function(data) {
      var cart = data.data && data.data.cartCreate && data.data.cartCreate.cart;
      if (cart && cart.checkoutUrl) {
        window.location.href = cart.checkoutUrl;
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
        alert('Something went wrong. Please try again.');
      }
    }).catch(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
      alert('Network error. Please try again.');
    });
}

// ─── IMAGE ZOOM LIGHTBOX ──────────────────────
function openImageZoom(src, alt) {
  var overlay = document.createElement('div');
  overlay.className = 'img-zoom-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Zoomed image');
  overlay.innerHTML = '<button class="img-zoom-close" aria-label="Close zoom">&#10005;</button>'
                    + '<img class="img-zoom-img" src="' + src + '" alt="' + (alt || '') + '">';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay || e.target.classList.contains('img-zoom-close')) overlay.remove();
  });
  document.addEventListener('keydown', function escZoom(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escZoom); }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('.img-zoom-close').focus();
}

function formatMoney(amount, currency) {
  if (currency === 'USD') return '$' + amount.toFixed(2).replace(/\.00$/, '');
  return currency + ' ' + amount.toFixed(2);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── DOM READY ────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // Email focus style
  var input = document.getElementById('emailInput');
  if (input) { input.addEventListener('focus', function() { this.style.outline = 'none'; }); }


  // ─── EMAIL SIGNUP — JSONP (no page redirect) ──
  var emailForm = document.querySelector('.email-section form');
  if (emailForm) {
    emailForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var emailVal = (document.getElementById('emailInput') || {}).value || '';
      emailVal = emailVal.trim();
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setEmailStatus('Please enter a valid email address.', false);
        return;
      }
      var btn = emailForm.querySelector('.form-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Joining\u2026'; }

      var url = emailForm.action.replace('/post?', '/post-json?')
              + '&EMAIL=' + encodeURIComponent(emailVal)
              + '&c=_mcCallback';

      window._mcCallback = function(res) {
        if (btn) { btn.disabled = false; btn.textContent = 'Get Early Access'; }
        if (res.result === 'success') {
          setEmailStatus('You\u2019re on the list. See you on opening day.', true);
          var row = emailForm.querySelector('.form-row');
          if (row) row.style.display = 'none';
        } else {
          var msg = (res.msg || 'Something went wrong. Try again.')
                    .replace(/<[^>]*>/g, '').replace(/^\d+ - /, '');
          setEmailStatus(msg, false);
        }
      };
      var s = document.createElement('script');
      s.src = url;
      document.head.appendChild(s);
    });

    function setEmailStatus(msg, ok) {
      var el = document.getElementById('emailStatus');
      if (!el) {
        el = document.createElement('p');
        el.id = 'emailStatus';
        var row = emailForm.querySelector('.form-row');
        if (row) row.after(el); else emailForm.appendChild(el);
      }
      el.className = 'email-status' + (ok ? ' email-status--ok' : ' email-status--err');
      el.textContent = msg;
    }
  }

  // ─── FETCH FREE KOOZIE PRODUCT ───────────────
  gql('{ products(first:5, query:"koozie") { edges { node { title variants(first:1) { edges { node { id price { amount currencyCode } image { url } } } } images(first:1) { edges { node { url } } } } } } }', {})
    .then(function(data) {
      var edges = data.data && data.data.products && data.data.products.edges;
      if (!edges || !edges.length) return;
      var node  = edges[0].node;
      var vNode = node.variants.edges[0] && node.variants.edges[0].node;
      if (!vNode) return;
      _koozieVariantId = vNode.id;
      _kooziePrice     = parseFloat(vNode.price.amount);
      _koozieCurrency  = vNode.price.currencyCode;
      _koozieName      = node.title;
      var imgEdges     = node.images && node.images.edges;
      _koozieImgUrl    = (vNode.image && vNode.image.url) || (imgEdges && imgEdges[0] && imgEdges[0].node.url) || '';
    });

  // ─── STICKY BAR ───────────────────────────────
  var stickyBar = document.getElementById('stickyBar');
  if (stickyBar) {
    var heroEl = document.querySelector('.hero');
    window.addEventListener('scroll', function() {
      var threshold = heroEl ? heroEl.offsetHeight * 0.55 : 400;
      stickyBar.classList.toggle('visible', window.scrollY > threshold);
    }, { passive: true });
  }

  // ─── CART ESCAPE KEY ──────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var drawer = document.getElementById('cartDrawer');
      if (drawer && drawer.classList.contains('open')) closeCart();
    }
  });

});

// ─── EYEBROW BANNER ROTATOR ──────────────────
(function rotateBanner() {
  var msgs = [
    'Coming to Downtown Roswell, Georgia',
    'Spend $25 \u2014 Get a Free Koozie \uD83E\uDDCA'
  ];
  var i = 0;
  var el = document.getElementById('eyebrow-text');
  if (!el) return;
  setInterval(function () {
    i = (i + 1) % msgs.length;
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = msgs[i];
      el.style.opacity = '1';
    }, 300);
  }, 4000);
})();
