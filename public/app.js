/* ==========================================================================
   QuisaFood - Core Application Logic (Vanilla JS - Fullstack Version)
   ========================================================================== */

// State Management
let state = {
  restaurants: [],
  categories: new Set(['Italiana', 'Asiática', 'Mexicana', 'Comida Rápida', 'Cafetería / Bakery', 'Carnes / Parrilla', 'Mariscos', 'Vegetariana / Vegana']),
  filters: {
    search: '',
    category: 'all',
    sortBy: 'rating-desc' // Default to best rated
  },
  theme: 'dark',
  uploadedImageBase64: '',
  uploadedAdditionalImages: [], // Array of base64 strings
  editingId: null,
  activeDetailId: null
};

// DOM Element Map
const DOM = {
  body: document.body,
  addBtnFab: document.getElementById('add-btn-fab'),
  addBtnEmpty: document.getElementById('add-btn-empty'),
  
  // Stats
  statTotal: document.getElementById('stat-total'),
  statRating: document.getElementById('stat-rating'),
  statTopCategory: document.getElementById('stat-top-category'),
  
  // Toolbar
  searchInput: document.getElementById('search-input'),
  filterCategory: document.getElementById('filter-category'),
  sortSelect: document.getElementById('sort-select'),
  
  // Grid & Empty State
  restaurantsGrid: document.getElementById('restaurants-grid'),
  emptyState: document.getElementById('empty-state'),
  
  // Modal / Form
  restaurantModal: document.getElementById('restaurant-modal'),
  modalTitle: document.getElementById('modal-title'),
  restaurantForm: document.getElementById('restaurant-form'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelModalBtn: document.getElementById('cancel-modal-btn'),
  saveModalBtn: document.getElementById('save-modal-btn'),
  restaurantId: document.getElementById('restaurant-id'),
  initialReviewSection: document.getElementById('initial-review-section'),
  
  // Primary Image Upload
  imageDropzone: document.getElementById('image-dropzone'),
  imageInput: document.getElementById('image-input'),
  dropzonePrompt: document.getElementById('dropzone-prompt'),
  imagePreview: document.getElementById('image-preview'),
  removeImageBtn: document.getElementById('remove-image-btn'),
  
  // Additional Images Upload
  uploadAdditionalBtn: document.getElementById('upload-additional-btn'),
  additionalImagesInput: document.getElementById('additional-images-input'),
  additionalPreviewsContainer: document.getElementById('additional-previews-container'),

  // Form Inputs
  inputName: document.getElementById('input-name'),
  inputCategory: document.getElementById('input-category'),
  inputCustomCategory: document.getElementById('input-custom-category'),
  inputDate: document.getElementById('input-date'),
  inputRating: document.getElementById('input-rating'),
  ratingValDisplay: document.getElementById('rating-val-display'),
  formStarsPreview: document.getElementById('form-stars-preview'),
  inputReviewerName: document.getElementById('input-reviewer-name'),
  inputDescription: document.getElementById('input-description'),
  
  // Detail Modal
  detailModal: document.getElementById('detail-modal'),
  detailImg: document.getElementById('detail-img'),
  closeDetailBtn: document.getElementById('close-detail-btn'),
  detailBadge: document.getElementById('detail-badge'),
  detailThumbnails: document.getElementById('detail-thumbnails'),
  detailName: document.getElementById('detail-name'),
  detailStarsInner: document.getElementById('detail-stars-inner'),
  detailRatingNumber: document.getElementById('detail-rating-number'),
  detailReviewsCount: document.getElementById('detail-reviews-count'),
  detailReviewsList: document.getElementById('detail-reviews-list'),
  detailEditBtn: document.getElementById('detail-edit-btn'),
  detailDeleteBtn: document.getElementById('detail-delete-btn'),
  
  // Inline review form in Detail Modal
  newReviewForm: document.getElementById('new-review-form'),
  reviewAuthor: document.getElementById('review-author'),
  reviewDate: document.getElementById('review-date'),
  reviewRating: document.getElementById('new-review-rating'),
  newReviewRatingVal: document.getElementById('new-review-rating-val'),
  newReviewStarsPreview: document.getElementById('new-review-stars-preview'),
  reviewDesc: document.getElementById('review-desc'),

  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// Initialization & API Communication
// ==========================================================================
async function init() {
  // Fetch Restaurants Database from Express Backend
  await fetchRestaurants();

  // Setup Event Listeners
  setupEventListeners();
}

async function fetchRestaurants() {
  try {
    const response = await fetch('/api/restaurants');
    if (!response.ok) throw new Error('API server error');
    state.restaurants = await response.json();
  } catch (error) {
    console.error('Error fetching restaurants from backend:', error);
    showToast('Error al conectar con la base de datos', 'danger');
  }

  updateCategoriesList();
  render();
}

function updateCategoriesList() {
  state.categories = new Set(['Italiana', 'Asiática', 'Mexicana', 'Comida Rápida', 'Cafetería / Bakery', 'Carnes / Parrilla', 'Mariscos', 'Vegetariana / Vegana']);
  state.restaurants.forEach(r => {
    if (r.category) {
      state.categories.add(r.category);
    }
  });
  populateFilterDropdown();
  populateFormCategoryDropdown();
}

function populateFilterDropdown() {
  DOM.filterCategory.innerHTML = '<option value="all">Todas las categorías</option>';
  const sortedCats = Array.from(state.categories).sort();
  sortedCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    DOM.filterCategory.appendChild(opt);
  });
}

function populateFormCategoryDropdown() {
  const predefined = ['Italiana', 'Asiática', 'Mexicana', 'Comida Rápida', 'Cafetería / Bakery', 'Carnes / Parrilla', 'Mariscos', 'Vegetariana / Vegana'];
  DOM.inputCategory.innerHTML = '<option value="" disabled selected>Selecciona o escribe...</option>';
  
  predefined.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    DOM.inputCategory.appendChild(opt);
  });

  const sortedCats = Array.from(state.categories).sort();
  sortedCats.forEach(cat => {
    if (!predefined.includes(cat)) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      DOM.inputCategory.insertBefore(opt, DOM.inputCategory.lastChild);
    }
  });

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '+ Crear nueva...';
  DOM.inputCategory.appendChild(customOpt);
}



// ==========================================================================
// Review Math Helpers
// ==========================================================================
function getAverageRating(restaurant) {
  if (!restaurant.reviews || restaurant.reviews.length === 0) return 0.0;
  const sum = restaurant.reviews.reduce((acc, r) => acc + parseFloat(r.rating), 0);
  return parseFloat((sum / restaurant.reviews.length).toFixed(1));
}

function getLatestReviewDate(restaurant) {
  if (!restaurant.reviews || restaurant.reviews.length === 0) return '1970-01-01';
  const sorted = [...restaurant.reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted[0].date;
}

// ==========================================================================
// Range Sliders Syncing
// ==========================================================================
function syncFormSlider(val) {
  const roundedVal = parseFloat(val).toFixed(1);
  DOM.ratingValDisplay.textContent = roundedVal;
  const percentage = (roundedVal / 5) * 100;
  DOM.formStarsPreview.style.width = `${percentage}%`;
}

function syncReviewSlider(val) {
  const roundedVal = parseFloat(val).toFixed(1);
  DOM.newReviewRatingVal.textContent = roundedVal;
  const percentage = (roundedVal / 5) * 100;
  DOM.newReviewStarsPreview.style.width = `${percentage}%`;
}

// ==========================================================================
// Image Uploads & File Readers
// ==========================================================================
function setupImageUpload() {
  // 1. Cover Image Upload
  DOM.imageDropzone.addEventListener('click', (e) => {
    if (e.target === DOM.removeImageBtn || DOM.removeImageBtn.contains(e.target)) return;
    DOM.imageInput.click();
  });

  DOM.imageInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      handleCoverImage(this.files[0]);
    }
  });

  // Drag & drop cover
  DOM.imageDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.imageDropzone.classList.add('dragover');
  });

  DOM.imageDropzone.addEventListener('dragleave', () => {
    DOM.imageDropzone.classList.remove('dragover');
  });

  DOM.imageDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.imageDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleCoverImage(files[0]);
    }
  });

  DOM.removeImageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCoverImage();
  });

  // 2. Additional Gallery Images Upload
  DOM.uploadAdditionalBtn.addEventListener('click', () => {
    DOM.additionalImagesInput.click();
  });

  DOM.additionalImagesInput.addEventListener('change', function() {
    if (this.files && this.files.length > 0) {
      handleAdditionalImages(Array.from(this.files));
    }
  });
}

function handleCoverImage(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Archivo no válido. Debe ser una imagen.', 'danger');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast('La portada supera el límite de 3MB.', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    state.uploadedImageBase64 = e.target.result;
    DOM.imagePreview.src = e.target.result;
    DOM.imagePreview.classList.remove('hide');
    DOM.dropzonePrompt.classList.add('hide');
    DOM.removeImageBtn.classList.remove('hide');
  };
  reader.readAsDataURL(file);
}

function clearCoverImage() {
  state.uploadedImageBase64 = '';
  DOM.imageInput.value = '';
  DOM.imagePreview.src = '';
  DOM.imagePreview.classList.add('hide');
  DOM.dropzonePrompt.classList.remove('hide');
  DOM.removeImageBtn.classList.add('hide');
}

function handleAdditionalImages(files) {
  files.forEach(file => {
    if (!file.type.startsWith('image/')) {
      showToast(`Archivo "${file.name}" omitido por no ser una imagen.`, 'danger');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast(`"${file.name}" supera el límite de 3MB.`, 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      state.uploadedAdditionalImages.push(e.target.result);
      renderAdditionalPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderAdditionalPreviews() {
  DOM.additionalPreviewsContainer.innerHTML = '';
  state.uploadedAdditionalImages.forEach((imgBase64, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'additional-thumb-wrapper';
    
    const img = document.createElement('img');
    img.src = imgBase64;
    img.alt = `Miniatura adicional ${index + 1}`;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-thumb';
    removeBtn.textContent = '×';
    removeBtn.title = 'Eliminar foto';
    
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.uploadedAdditionalImages.splice(index, 1);
      renderAdditionalPreviews();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    DOM.additionalPreviewsContainer.appendChild(wrapper);
  });
}

// Category custom option logic
function setupCategoryTrigger() {
  DOM.inputCategory.addEventListener('change', function() {
    if (this.value === 'custom') {
      DOM.inputCustomCategory.classList.remove('hide');
      DOM.inputCustomCategory.required = true;
      DOM.inputCustomCategory.focus();
    } else {
      DOM.inputCustomCategory.classList.add('hide');
      DOM.inputCustomCategory.required = false;
      DOM.inputCustomCategory.value = '';
    }
  });
}

// ==========================================================================
// Modal Operations (Add, Edit, Close, Save)
// ==========================================================================
function openAddModal() {
  state.editingId = null;
  state.uploadedAdditionalImages = [];
  DOM.modalTitle.textContent = 'Registrar Restaurante';
  DOM.saveModalBtn.textContent = 'Guardar Registro';
  DOM.restaurantForm.reset();
  
  clearCoverImage();
  renderAdditionalPreviews();

  // Reset ratings slider
  DOM.inputRating.value = '4.5';
  syncFormSlider(4.5);

  // Show review section since this is a new restaurant
  DOM.initialReviewSection.classList.remove('hide');
  DOM.inputReviewerName.required = true;
  DOM.inputDate.required = true;
  DOM.inputDescription.required = true;

  // Set date to today
  DOM.inputDate.value = new Date().toISOString().split('T')[0];

  // Hide custom input category
  DOM.inputCustomCategory.classList.add('hide');
  DOM.inputCustomCategory.required = false;

  // Clear validation styling
  const formGroups = DOM.restaurantForm.querySelectorAll('.form-group');
  formGroups.forEach(group => group.classList.remove('invalid'));

  DOM.restaurantModal.classList.remove('hide');
  DOM.restaurantModal.setAttribute('aria-hidden', 'false');
  DOM.body.style.overflow = 'hidden';
}

function openEditModal(restaurant) {
  state.editingId = restaurant.id;
  state.uploadedAdditionalImages = [...restaurant.additionalImages];
  DOM.modalTitle.textContent = 'Editar Restaurante';
  DOM.saveModalBtn.textContent = 'Actualizar Local';
  
  DOM.inputName.value = restaurant.name;

  // Prepopulate category selection
  const predefined = ['Italiana', 'Asiática', 'Mexicana', 'Comida Rápida', 'Cafetería / Bakery', 'Carnes / Parrilla', 'Mariscos', 'Vegetariana / Vegana'];
  if (predefined.includes(restaurant.category)) {
    DOM.inputCategory.value = restaurant.category;
    DOM.inputCustomCategory.classList.add('hide');
    DOM.inputCustomCategory.required = false;
    DOM.inputCustomCategory.value = '';
  } else {
    DOM.inputCategory.value = 'custom';
    DOM.inputCustomCategory.classList.remove('hide');
    DOM.inputCustomCategory.required = true;
    DOM.inputCustomCategory.value = restaurant.category;
  }

  // Prepopulate Cover Image
  if (restaurant.image) {
    state.uploadedImageBase64 = restaurant.image;
    DOM.imagePreview.src = restaurant.image;
    DOM.imagePreview.classList.remove('hide');
    DOM.dropzonePrompt.classList.add('hide');
    DOM.removeImageBtn.classList.remove('hide');
  } else {
    clearCoverImage();
  }

  // Prepopulate Additional Images previews
  renderAdditionalPreviews();

  // Hide initial review section since reviews are handled separately
  DOM.initialReviewSection.classList.add('hide');
  DOM.inputReviewerName.required = false;
  DOM.inputDate.required = false;
  DOM.inputDescription.required = false;

  // Clear validation styling
  const formGroups = DOM.restaurantForm.querySelectorAll('.form-group');
  formGroups.forEach(group => group.classList.remove('invalid'));

  DOM.restaurantModal.classList.remove('hide');
  DOM.restaurantModal.setAttribute('aria-hidden', 'false');
  DOM.body.style.overflow = 'hidden';
}

function closeModal() {
  DOM.restaurantModal.classList.add('hide');
  DOM.restaurantModal.setAttribute('aria-hidden', 'true');
  DOM.body.style.overflow = '';
}

async function handleFormSubmit(e) {
  e.preventDefault();

  let isValid = true;

  // 1. Name Check
  if (!DOM.inputName.value.trim()) {
    DOM.inputName.parentElement.classList.add('invalid');
    isValid = false;
  } else {
    DOM.inputName.parentElement.classList.remove('invalid');
  }

  // 2. Category Check
  const categoryVal = DOM.inputCategory.value;
  if (!categoryVal) {
    DOM.inputCategory.parentElement.parentElement.classList.add('invalid');
    isValid = false;
  } else if (categoryVal === 'custom' && !DOM.inputCustomCategory.value.trim()) {
    DOM.inputCategory.parentElement.parentElement.classList.add('invalid');
    isValid = false;
  } else {
    DOM.inputCategory.parentElement.parentElement.classList.remove('invalid');
  }

  // Determine final category string
  const finalCategory = categoryVal === 'custom' 
    ? capitalize(DOM.inputCustomCategory.value.trim()) 
    : categoryVal;

  // 3. Cover Image Check (Must upload a cover)
  const defaultImages = {
    'Italiana': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    'Asiática': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
    'Mexicana': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80',
    'Comida Rápida': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    'Cafetería / Bakery': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80'
  };
  const finalCoverImage = state.uploadedImageBase64 || 
                         defaultImages[finalCategory] || 
                         'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

  // 4. If creating new restaurant, validate the Initial Review
  let reviewsList = [];
  if (!state.editingId) {
    if (!DOM.inputReviewerName.value.trim()) {
      DOM.inputReviewerName.parentElement.classList.add('invalid');
      isValid = false;
    } else {
      DOM.inputReviewerName.parentElement.classList.remove('invalid');
    }

    if (!DOM.inputDate.value) {
      DOM.inputDate.parentElement.classList.add('invalid');
      isValid = false;
    } else {
      DOM.inputDate.parentElement.classList.remove('invalid');
    }

    if (!DOM.inputDescription.value.trim()) {
      DOM.inputDescription.parentElement.classList.add('invalid');
      isValid = false;
    } else {
      DOM.inputDescription.parentElement.classList.remove('invalid');
    }

    if (isValid) {
      reviewsList = [{
        id: 'rev-' + Date.now(),
        author: sanitizeHTML(DOM.inputReviewerName.value.trim()),
        rating: parseFloat(DOM.inputRating.value),
        description: sanitizeHTML(DOM.inputDescription.value.trim()),
        date: DOM.inputDate.value
      }];
    }
  }

  if (!isValid) {
    showToast('Por favor completa todos los campos requeridos', 'danger');
    return;
  }

  // Define request body and parameters
  let url = '/api/restaurants';
  let method = 'POST';
  let bodyData = {};

  if (state.editingId) {
    url = `/api/restaurants/${state.editingId}`;
    method = 'PUT';
    bodyData = {
      name: sanitizeHTML(DOM.inputName.value.trim()),
      category: sanitizeHTML(finalCategory),
      image: finalCoverImage,
      additionalImages: [...state.uploadedAdditionalImages]
    };
  } else {
    bodyData = {
      id: 'rest-' + Date.now(),
      name: sanitizeHTML(DOM.inputName.value.trim()),
      category: sanitizeHTML(finalCategory),
      image: finalCoverImage,
      additionalImages: [...state.uploadedAdditionalImages],
      reviews: reviewsList
    };
  }

  try {
    DOM.saveModalBtn.disabled = true;
    DOM.saveModalBtn.textContent = 'Guardando...';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) throw new Error('API server error');

    showToast(state.editingId ? 'Datos del local actualizados' : 'Restaurante registrado con éxito', 'success');
    closeModal();
    await fetchRestaurants(); // Refreshes grid and stats from db
  } catch (error) {
    console.error('Error saving restaurant:', error);
    showToast('Error al conectar con el servidor', 'danger');
  } finally {
    DOM.saveModalBtn.disabled = false;
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// ==========================================================================
// Details View Modal
// ==========================================================================
function openDetailModal(id) {
  const rest = state.restaurants.find(r => r.id === id);
  if (!rest) return;

  state.activeDetailId = id;
  
  DOM.detailImg.src = rest.image;
  DOM.detailImg.alt = rest.name;
  DOM.detailBadge.textContent = rest.category;
  DOM.detailName.textContent = rest.name;

  // Calculate rating numbers
  const avg = getAverageRating(rest);
  DOM.detailRatingNumber.textContent = avg > 0 ? avg.toFixed(1) : 'S/V';
  DOM.detailReviewsCount.textContent = `(${rest.reviews.length} ${rest.reviews.length === 1 ? 'reseña' : 'reseñas'})`;

  // Draw average stars with percentage
  DOM.detailStarsInner.style.width = `${(avg / 5) * 100}%`;

  // Reset new review inline form inside details
  DOM.newReviewForm.reset();
  DOM.reviewDate.value = new Date().toISOString().split('T')[0];
  DOM.reviewRating.value = '4.0';
  syncReviewSlider(4.0);

  // Render Additional Images Gallery Thumbnails
  renderGalleryThumbnails(rest);

  // Render reviews timeline
  renderReviewsTimeline(rest);

  DOM.detailModal.classList.remove('hide');
  DOM.detailModal.setAttribute('aria-hidden', 'false');
  DOM.body.style.overflow = 'hidden';
}

function renderGalleryThumbnails(rest) {
  DOM.detailThumbnails.innerHTML = '';
  
  if (!rest.additionalImages || rest.additionalImages.length === 0) {
    DOM.detailThumbnails.classList.add('hide');
    return;
  }
  DOM.detailThumbnails.classList.remove('hide');

  // Add cover as first thumbnail option
  const coverThumb = document.createElement('img');
  coverThumb.src = rest.image;
  coverThumb.className = 'detail-thumb active';
  coverThumb.alt = 'Portada';
  coverThumb.addEventListener('click', () => {
    DOM.detailImg.src = rest.image;
    document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
    coverThumb.classList.add('active');
  });
  DOM.detailThumbnails.appendChild(coverThumb);

  // Add other thumbnails
  rest.additionalImages.forEach((imgUrl, idx) => {
    const thumb = document.createElement('img');
    thumb.src = imgUrl;
    thumb.className = 'detail-thumb';
    thumb.alt = `Galería ${idx + 1}`;
    thumb.addEventListener('click', () => {
      DOM.detailImg.src = imgUrl;
      document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
    DOM.detailThumbnails.appendChild(thumb);
  });
}

function renderReviewsTimeline(rest) {
  DOM.detailReviewsList.innerHTML = '';
  
  // Sort reviews chronological descending (latest first)
  const sortedReviews = [...rest.reviews].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedReviews.forEach(rev => {
    const item = document.createElement('div');
    item.className = 'review-item';
    
    // Get initials for profile picture
    const initials = rev.author ? rev.author.substring(0, 2) : 'AN';

    item.innerHTML = `
      <div class="review-avatar">${initials}</div>
      <div class="review-content">
        <div class="review-header">
          <span class="review-author">${rev.author}</span>
          <div class="review-meta-info">
            <div class="stars-outer" style="font-size: 0.9rem;">
              <div class="stars-inner" style="width: ${(rev.rating / 5) * 100}%;"></div>
            </div>
            <span class="review-rating-num">${parseFloat(rev.rating).toFixed(1)}</span>
            <span class="review-date">${formatDate(rev.date)}</span>
          </div>
        </div>
        <p class="review-text">${rev.description}</p>
      </div>
      ${rest.reviews.length > 1 ? `
        <button class="btn-card-action delete-action delete-review-btn" data-review-id="${rev.id}" title="Eliminar reseña" aria-label="Eliminar reseña" style="margin-left: 0.5rem; align-self: flex-start;">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      ` : ''}
    `;

    const delBtn = item.querySelector('.delete-review-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('¿Deseas eliminar esta reseña de la bitácora?')) {
          deleteReview(rest.id, rev.id);
        }
      });
    }

    DOM.detailReviewsList.appendChild(item);
  });
}

async function handleAddReviewSubmit(e) {
  e.preventDefault();
  
  const rest = state.restaurants.find(r => r.id === state.activeDetailId);
  if (!rest) return;

  const author = DOM.reviewAuthor.value.trim();
  const desc = DOM.reviewDesc.value.trim();
  const date = DOM.reviewDate.value;
  const rating = parseFloat(DOM.reviewRating.value);

  if (!author || !desc || !date) {
    showToast('Por favor completa todos los campos de reseña', 'danger');
    return;
  }

  const newReview = {
    id: 'rev-' + Date.now(),
    author: sanitizeHTML(author),
    rating: rating,
    description: sanitizeHTML(desc),
    date: date
  };

  try {
    const response = await fetch(`/api/restaurants/${state.activeDetailId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReview)
    });

    if (!response.ok) throw new Error('API server error');

    showToast('¡Reseña agregada con éxito!', 'success');
    await fetchRestaurants();
    openDetailModal(rest.id); // Reload detail view
  } catch (error) {
    console.error('Error adding review:', error);
    showToast('Error al publicar la reseña', 'danger');
  }
}

async function deleteReview(restaurantId, reviewId) {
  try {
    const response = await fetch(`/api/restaurants/${restaurantId}/reviews/${reviewId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('API server error');

    showToast('Reseña eliminada', 'success');
    await fetchRestaurants();
    openDetailModal(restaurantId); // Reload detail view
  } catch (error) {
    console.error('Error deleting review:', error);
    showToast('Error al eliminar la reseña', 'danger');
  }
}

function closeDetailModal() {
  DOM.detailModal.classList.add('hide');
  DOM.detailModal.setAttribute('aria-hidden', 'true');
  DOM.body.style.overflow = '';
  state.activeDetailId = null;
}

function handleDetailEdit() {
  const rest = state.restaurants.find(r => r.id === state.activeDetailId);
  if (!rest) return;
  closeDetailModal();
  openEditModal(rest);
}

function handleDetailDelete() {
  if (confirm('¿Estás seguro de que deseas eliminar este restaurante y todas sus reseñas asociadas?')) {
    deleteRestaurant(state.activeDetailId);
    closeDetailModal();
  }
}

async function deleteRestaurant(id) {
  try {
    const response = await fetch(`/api/restaurants/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('API server error');

    showToast('Restaurante eliminado de la bitácora', 'danger');
    await fetchRestaurants();
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    showToast('Error al eliminar el restaurante', 'danger');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.classList.add('toast', `toast-${type}`);
  toast.innerText = message;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// ==========================================================================
// Filtering, Sorting and Rendering Grid
// ==========================================================================
function handleSearch(e) {
  state.filters.search = e.target.value.toLowerCase().trim();
  renderGrid();
}

function handleCategoryFilter(e) {
  state.filters.category = e.target.value;
  renderGrid();
}

function handleSorting(e) {
  state.filters.sortBy = e.target.value;
  renderGrid();
}

function render() {
  renderStats();
  renderGrid();
}

function renderStats() {
  const count = state.restaurants.length;
  DOM.statTotal.textContent = count;

  if (count === 0) {
    DOM.statRating.textContent = '0.0';
    DOM.statTopCategory.textContent = '-';
    return;
  }

  // Calculate Avg Rating (All reviews of all restaurants combined)
  let totalRating = 0;
  let totalReviews = 0;
  
  state.restaurants.forEach(r => {
    if (r.reviews) {
      r.reviews.forEach(rev => {
        totalRating += parseFloat(rev.rating);
        totalReviews++;
      });
    }
  });

  const avg = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : '0.0';
  DOM.statRating.textContent = avg;

  // Calculate Top Category
  const catCount = {};
  state.restaurants.forEach(r => {
    if (r.category) {
      catCount[r.category] = (catCount[r.category] || 0) + 1;
    }
  });

  let topCategory = '-';
  let maxCount = 0;
  for (const cat in catCount) {
    if (catCount[cat] > maxCount) {
      maxCount = catCount[cat];
      topCategory = cat;
    }
  }
  DOM.statTopCategory.textContent = topCategory;
}

function renderGrid() {
  DOM.restaurantsGrid.innerHTML = '';
  
  // Apply Search and Category Filters
  let filtered = state.restaurants.filter(r => {
    const matchesCategory = state.filters.category === 'all' || r.category === state.filters.category;
    
    // Check if name or category matches
    const nameMatch = r.name.toLowerCase().includes(state.filters.search);
    const categoryMatch = r.category.toLowerCase().includes(state.filters.search);
    
    // Check if any review author or description matches search
    const reviewsMatch = r.reviews && r.reviews.some(rev => 
      rev.author.toLowerCase().includes(state.filters.search) || 
      rev.description.toLowerCase().includes(state.filters.search)
    );

    return matchesCategory && (nameMatch || categoryMatch || reviewsMatch);
  });

  // Apply Sorting
  filtered.sort((a, b) => {
    const ratingA = getAverageRating(a);
    const ratingB = getAverageRating(b);
    const dateA = getLatestReviewDate(a);
    const dateB = getLatestReviewDate(b);

    switch (state.filters.sortBy) {
      case 'rating-desc':
        return ratingB - ratingA;
      case 'rating-asc':
        return ratingA - ratingB;
      case 'date-desc':
        return new Date(dateB) - new Date(dateA);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // Render Grid Cards
  if (filtered.length === 0) {
    DOM.restaurantsGrid.classList.add('hide');
    DOM.emptyState.classList.remove('hide');
  } else {
    DOM.emptyState.classList.add('hide');
    DOM.restaurantsGrid.classList.remove('hide');

    filtered.forEach((rest, index) => {
      const card = document.createElement('article');
      card.className = 'restaurant-card card-glass animate-fade-in';
      card.style.setProperty('--delay', (index % 3) + 1);
      card.dataset.id = rest.id;
      
      const avg = getAverageRating(rest);
      const latestDate = getLatestReviewDate(rest);

      // Render star visualizer width percentage
      const starWidthPercentage = (avg / 5) * 100;
      
      card.innerHTML = `
        <div class="card-img-wrapper">
          <img src="${rest.image}" alt="${rest.name}" loading="lazy">
          <span class="category-badge">${rest.category}</span>
          <span class="card-rating-badge">★ ${avg > 0 ? avg.toFixed(1) : 'S/V'}</span>
        </div>
        <div class="card-body">
          <span class="card-date">Última reseña: ${formatDate(latestDate)}</span>
          <h3 class="card-title">${rest.name}</h3>
          
          <div class="stars-outer" style="font-size: 1rem; margin-bottom: 0.75rem;">
            <div class="stars-inner" style="width: ${starWidthPercentage}%;"></div>
          </div>
          
          <p class="card-description">
            ${rest.reviews && rest.reviews.length > 0 ? `<strong>${rest.reviews[0].author}:</strong> "${rest.reviews[0].description}"` : 'Sin reseñas todavía.'}
          </p>
          
          <div class="card-footer">
            <span class="reviews-count" style="margin-right: auto; align-self: center;">${rest.reviews ? rest.reviews.length : 0} ${rest.reviews && rest.reviews.length === 1 ? 'opinión' : 'opiniones'}</span>
            <button class="btn-card-action edit-action" title="Editar Local" aria-label="Editar restaurante">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-card-action delete-action" title="Eliminar Local" aria-label="Eliminar restaurante">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        const isButton = e.target.closest('.btn-card-action');
        if (!isButton) {
          openDetailModal(rest.id);
        }
      });

      card.querySelector('.edit-action').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(rest);
      });

      card.querySelector('.delete-action').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Estás seguro de que deseas eliminar "${rest.name}" y todas sus reseñas?`)) {
          deleteRestaurant(rest.id);
        }
      });

      DOM.restaurantsGrid.appendChild(card);
    });
  }
}

// ==========================================================================
// Event Listeners Binding
// ==========================================================================
function setupEventListeners() {
  DOM.searchInput.addEventListener('input', handleSearch);
  DOM.filterCategory.addEventListener('change', handleCategoryFilter);
  DOM.sortSelect.addEventListener('change', handleSorting);

  if (DOM.addBtnFab) {
    DOM.addBtnFab.addEventListener('click', openAddModal);
  }
  DOM.addBtnEmpty.addEventListener('click', openAddModal);
  
  DOM.closeModalBtn.addEventListener('click', closeModal);
  DOM.cancelModalBtn.addEventListener('click', closeModal);
  DOM.restaurantForm.addEventListener('submit', handleFormSubmit);

  // Sync range inputs with text displays and star percentages in real time
  DOM.inputRating.addEventListener('input', (e) => {
    syncFormSlider(e.target.value);
  });

  DOM.reviewRating.addEventListener('input', (e) => {
    syncReviewSlider(e.target.value);
  });

  // Submit handler for adding a review in Detail modal
  DOM.newReviewForm.addEventListener('submit', handleAddReviewSubmit);

  // Click outside modal
  window.addEventListener('click', (e) => {
    if (e.target === DOM.restaurantModal) {
      closeModal();
    }
    if (e.target === DOM.detailModal) {
      closeDetailModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
    }
  });

  DOM.closeDetailBtn.addEventListener('click', closeDetailModal);
  DOM.detailEditBtn.addEventListener('click', handleDetailEdit);
  DOM.detailDeleteBtn.addEventListener('click', handleDetailDelete);

  setupImageUpload();
  setupCategoryTrigger();
}

document.addEventListener('DOMContentLoaded', init);
