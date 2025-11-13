import { getDatabase, ref, set, get, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Firebase Initialization ---
const app = window.firebaseApp; // Get the initialized app from the window
const db = getDatabase(app);

// We wrap the entire script in DOMContentLoaded to ensure the DOM is ready.
// Since we are using modules, the script is deferred by default, but this is good practice.
document.addEventListener('DOMContentLoaded', () => {

    // Modal elements
    const modal = document.getElementById('product-modal');
    const addProductBtn = document.getElementById('add-product-btn');
    const closeButton = document.querySelector('.close-button');

    // Form elements
    const productForm = document.getElementById('product-form');
    const productNameInput = document.getElementById('product-name');
    const quantityInput = document.getElementById('quantity');
    const expiryDayInput = document.getElementById('expiry-day');
    const expiryMonthInput = document.getElementById('expiry-month');
    const expiryYearInput = document.getElementById('expiry-year');
    const barcodeInput = document.getElementById('barcode-value');

    // List and clear button
    const productListDiv = document.getElementById('product-list');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const sortSelect = document.getElementById('sort-select');
    const searchInput = document.getElementById('search-input');
    const showExpiredOnlyFilter = document.getElementById('show-expired-only-filter');

    // Confirmation Modal elements
    const confirmClearModal = document.getElementById('confirm-clear-modal');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');

    // Update Quantity Modal elements
    const updateQuantityModal = document.getElementById('update-quantity-modal');
    const confirmUpdateBtn = document.getElementById('confirm-update-btn');
    const cancelUpdateBtn = document.getElementById('cancel-update-btn');
    let pendingProduct = null; // To hold product data during confirmation

    // Settings Modal elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importTextarea = document.getElementById('import-textarea');
    const importFromTextBtn = document.getElementById('import-from-text-btn');

    // Firebase Sync elements
    const generateSyncCodeBtn = document.getElementById('generate-sync-code-btn');
    const syncCodeDisplay = document.getElementById('sync-code-display');
    const syncCodeText = document.getElementById('sync-code-text');
    const syncCodeInput = document.getElementById('sync-code-input');
    const syncFromCodeBtn = document.getElementById('sync-from-code-btn');

    // Generic Notification Modal elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationActions = document.getElementById('notification-actions');


    // --- State Management ---
    let products = [];

    /**
     * Migrates data from the old format (flat array) to the new format (grouped by barcode).
     * This runs once if old data is detected.
     */
    const migrateData = () => {
        const oldData = JSON.parse(localStorage.getItem('products'));
        if (!oldData || oldData.length === 0 || (oldData[0] && oldData[0].expiries)) {
            // No data, or data is already in the new format
            products = oldData || [];
            return;
        }

        console.log("Old data format detected. Migrating...");
        const newProducts = [];
        oldData.forEach(oldProduct => {
            let productGroup = newProducts.find(p => p.barcode === oldProduct.barcode);
            if (!productGroup) {
                productGroup = {
                    id: oldProduct.id, // Use the first encountered ID
                    name: oldProduct.name,
                    barcode: oldProduct.barcode,
                    lastModified: oldProduct.id, // Set initial lastModified to creation time
                    expiries: []
                };
                newProducts.push(productGroup);
            }
            productGroup.expiries.push({
                expiryDate: oldProduct.expiryDate,
                quantity: oldProduct.quantity
            });
        });
        products = newProducts;
        saveProducts(); // Save the newly formatted data
    };

    // --- Modal Logic ---
    addProductBtn.onclick = () => {
        productForm.reset(); // Clear form inputs
        modal.classList.remove('hidden');
    };
    closeButton.onclick = () => modal.classList.add('hidden');
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) { // Click on modal background
            modal.classList.add('hidden');
            confirmClearModal.classList.add('hidden');
            updateQuantityModal.classList.add('hidden');
            settingsModal.classList.add('hidden');
            notificationModal.classList.add('hidden');
        }
    };

    // --- Core Functions ---

    /**
     * Shows a custom notification modal.
     * @param {string} message The message to display.
     * @param {string} [title='Notification'] The title for the modal.
     * @param {Function} [callback=null] A callback function to execute when the 'Confirm' button is clicked.
     */
    const showNotification = (message, title = 'Notification', callback = null) => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notificationActions.innerHTML = ''; // Clear previous buttons

        if (callback) { // If a callback is provided, it's a confirmation dialog
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'btn-secondary';
            cancelBtn.onclick = () => notificationModal.classList.add('hidden');

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Confirm';
            confirmBtn.className = 'btn-danger'; // Use danger for confirmation actions
            confirmBtn.onclick = () => {
                notificationModal.classList.add('hidden');
                callback();
            };
            notificationActions.append(cancelBtn, confirmBtn);
        } else { // It's a simple alert
            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.className = 'btn-primary';
            okBtn.onclick = () => notificationModal.classList.add('hidden');
            notificationActions.appendChild(okBtn);
        }

        notificationModal.classList.remove('hidden');
    };

    const saveProducts = () => {
        localStorage.setItem('products', JSON.stringify(products));
    };

    const renderProducts = () => {
        productListDiv.innerHTML = ''; // Clear the list

        if (products.length === 0) {
            productListDiv.innerHTML = '<p style="text-align: center; color: #777;">No products registered yet. Click the "+" button to add one!</p>';
            return;
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        let filteredProducts = products;

        if (searchTerm) { // Filter by name or barcode
            filteredProducts = products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.barcode.includes(searchTerm)
            );
        }

        // Apply "Show Expired Only" filter
        const showExpiredOnly = showExpiredOnlyFilter.checked;
        if (showExpiredOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            filteredProducts = filteredProducts.filter(product => {
                // A product is considered "expired" if it has at least one expiry entry that is in the past.
                return product.expiries.some(expiry => {
                    const expiryDateObj = new Date(expiry.expiryDate);
                    expiryDateObj.setHours(0, 0, 0, 0);
                    return expiryDateObj < today;
                });
            });
        }


        const sortBy = sortSelect.value;

        if (sortBy === 'expiryDate') {
            // Sort by expiry date, with the nearest date at the top
            filteredProducts.sort((a, b) => {
                const nearestA = Math.min(...a.expiries.map(e => new Date(e.expiryDate).getTime()));
                const nearestB = Math.min(...b.expiries.map(e => new Date(e.expiryDate).getTime()));
                return nearestA - nearestB;
            });
        } else if (sortBy === 'lastModified') {
            // Sort by last modified date, newest first
            filteredProducts.sort((a, b) => (b.lastModified || b.id) - (a.lastModified || a.id));
        } else if (sortBy === 'name') {
            // Sort by product name, alphabetically
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        }

        filteredProducts.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'product-item';
            productItem.dataset.id = product.id;

            // Sort expiries within the product card by date
            product.expiries.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

            const expiryListHTML = product.expiries.map(expiry => {
                const [year, month, day] = expiry.expiryDate.split('-');
                const displayDate = `${day}/${month}/${year}`;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiryDateObj = new Date(expiry.expiryDate);
                expiryDateObj.setHours(0, 0, 0, 0);

                const timeDiff = expiryDateObj.getTime() - today.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                let statusClass = '';
                if (dayDiff < 0) statusClass = 'expired';
                else if (dayDiff <= 7) statusClass = 'expiring-soon';

                return /*html*/`
                    <li class="expiry-item ${statusClass}" data-expiry-date="${expiry.expiryDate}">
                        <div class="expiry-details">
                            <span><strong>Expires:</strong> ${displayDate}</span>
                            <span class="quantity-control">
                                <button class="quantity-btn decrease-quantity" title="Decrease Quantity">-</button>
                                <span class="product-quantity">${expiry.quantity}</span>
                                <button class="quantity-btn increase-quantity" title="Increase Quantity">+</button>
                            </span>
                        </div>
                        <button class="delete-btn" title="Delete this expiry entry"><i class="fas fa-trash-alt"></i></button>
                    </li>
                `;
            }).join('');

            productItem.innerHTML = /*html*/`
                <div class="product-header">
                    <div class="product-header-info">
                        <p><strong>${product.name}</strong></p>
                        <p><small>IBN: ${product.barcode}</small></p>
                    </div>
                </div>
                <ul class="expiry-list">${expiryListHTML}</ul>
                <div class="barcode-container">
                    <svg class="barcode-svg"></svg>
                </div>
            `;

            productListDiv.appendChild(productItem);

            // Generate barcode for the item
            JsBarcode(productItem.querySelector('.barcode-svg'), product.barcode, {
                format: "CODE128", // Or your preferred format
                lineColor: "#000",
                width: 2,
                height: 60,
                displayValue: false
            });
        });
    };

    // --- Event Listeners ---

    productForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const day = expiryDayInput.value.padStart(2, '0');
        const month = expiryMonthInput.value.padStart(2, '0');
        const year = expiryYearInput.value;
        const isoDate = `${year}-${month}-${day}`;

        const barcode = barcodeInput.value.trim();
        const quantity = parseInt(quantityInput.value);
        const name = productNameInput.value;

        let productGroup = products.find(p => p.barcode === barcode);

        if (productGroup) {
            // Product with this barcode already exists, find the expiry entry
            let expiryEntry = productGroup.expiries.find(e => e.expiryDate === isoDate);
            if (expiryEntry) {
                // Same barcode, same date -> ask to update quantity
                pendingProduct = { productGroup, expiryEntry, quantityToAdd: quantity };
                updateQuantityModal.classList.remove('hidden'); // Show confirmation modal
            } else {
                // Same barcode, different date -> add new expiry entry
                productGroup.expiries.push({ expiryDate: isoDate, quantity: quantity });
                productGroup.lastModified = Date.now(); // Update timestamp
                saveAndRender();
            }
        } else {
            // No existing product with this barcode -> add a new product group
            const newProductGroup = {
                id: Date.now(),
                name: name,
                barcode: barcode,
                lastModified: Date.now(), // Set timestamp on creation
                expiries: [{ expiryDate: isoDate, quantity: quantity }]
            };
            products.push(newProductGroup);
            saveAndRender();
        }

        modal.classList.add('hidden');
        productForm.reset();
    });

    // This function is no longer needed as logic is moved into the submit handler
    // function addNewProduct(isoDate, barcode) { ... }

    function saveAndRender() {
        saveProducts(); 
        renderProducts();
        productForm.reset();
    }

    confirmUpdateBtn.addEventListener('click', () => {
        const { productGroup, expiryEntry, quantityToAdd } = pendingProduct;
        expiryEntry.quantity += quantityToAdd;
        productGroup.lastModified = Date.now(); // Update timestamp
        saveAndRender();
        updateQuantityModal.classList.add('hidden');
        pendingProduct = null;
    });

    productListDiv.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('.delete-btn');
        const increaseBtn = event.target.closest('.increase-quantity');
        const decreaseBtn = event.target.closest('.decrease-quantity');

        if (deleteButton) {
            const productItem = deleteButton.closest('.product-item');
            const productId = Number(productItem.dataset.id);
            const productGroup = products.find(p => p.id === productId);
            const expiryItem = deleteButton.closest('.expiry-item');
            const expiryDate = expiryItem.dataset.expiryDate;

            if (productGroup) {
                const deleteCallback = () => {
                    // Find and remove the specific expiry entry
                    productGroup.expiries = productGroup.expiries.filter(e => e.expiryDate !== expiryDate);
                    // If no expiries are left, remove the entire product group
                    if (productGroup.expiries.length === 0) {
                        products = products.filter(p => p.id !== productId);
                    }
                    productGroup.lastModified = Date.now(); // Even deletion is a modification
                    saveAndRender();
                };
                showNotification(`Are you sure you want to delete the entry for "${productGroup.name}" expiring on ${expiryDate.split('-').reverse().join('/')}?`, 'Confirm Deletion', deleteCallback);
            }
        } else if (increaseBtn) {
            const productItem = increaseBtn.closest('.product-item');
            const productId = Number(productItem.dataset.id);
            const productGroup = products.find(p => p.id === productId);
            const expiryDate = increaseBtn.closest('.expiry-item').dataset.expiryDate;
            const expiry = productGroup.expiries.find(e => e.expiryDate === expiryDate);
            expiry.quantity++;
            productGroup.lastModified = Date.now(); // Update timestamp
            saveAndRender();
        } else if (decreaseBtn) {
            const productItem = decreaseBtn.closest('.product-item');
            const productId = Number(productItem.dataset.id);
            const productGroup = products.find(p => p.id === productId);
            const expiryDate = decreaseBtn.closest('.expiry-item').dataset.expiryDate;
            const expiry = productGroup.expiries.find(e => e.expiryDate === expiryDate);
            if (expiry.quantity > 1) {
                expiry.quantity--;
                productGroup.lastModified = Date.now(); // Update timestamp
                saveAndRender();
            } // Optional: You could add a confirmation to delete if quantity becomes 0
        }
    });

    clearAllBtn.addEventListener('click', () => {
        confirmClearModal.classList.remove('hidden');
    });

    cancelClearBtn.addEventListener('click', () => {
        confirmClearModal.classList.add('hidden');
    });

    confirmClearBtn.addEventListener('click', () => {
        products = [];
        saveProducts();
        renderProducts();
        confirmClearModal.classList.add('hidden');
    });

    cancelUpdateBtn.addEventListener('click', () => {
        updateQuantityModal.classList.add('hidden');
        pendingProduct = null;
    });

    settingsBtn.addEventListener('click', () => {
        importTextarea.value = ''; // Clear the textarea on open
        settingsModal.classList.remove('hidden');
    });

    // Find the close button inside the settings modal and add a listener
    settingsModal.querySelector('.close-button').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    exportDataBtn.addEventListener('click', async () => {
        if (products.length === 0) {
            showNotification('There is no data to export.', 'Export Failed');
            return;
        }
        const dataStr = JSON.stringify(products, null, 2); // Pretty-print JSON
        try {
            await navigator.clipboard.writeText(dataStr);
            const originalText = exportDataBtn.textContent;
            exportDataBtn.textContent = 'Copied!';
            setTimeout(() => {
                exportDataBtn.textContent = originalText;
                settingsModal.classList.add('hidden');
            }, 1500);
        } catch (err) {
            showNotification('Failed to copy data to the clipboard. Your browser might not support this feature or has blocked it.', 'Error');
            console.error('Clipboard write failed: ', err);
        }
    });

    importFromTextBtn.addEventListener('click', () => {
        const dataStr = importTextarea.value.trim();
        if (!dataStr) {
            showNotification('Please paste your data into the text box before importing.', 'Import Error');
            return;
        }

        try {
            const importedProducts = JSON.parse(dataStr);
            if (Array.isArray(importedProducts)) {
                const importCallback = () => {
                    products = importedProducts;
                    saveAndRender();
                    importTextarea.value = ''; // Clear textarea after import
                    settingsModal.classList.add('hidden');
                    showNotification(`Successfully imported ${products.length} products.`, 'Import Complete');
                };
                showNotification('This will replace all current data with the pasted content. This action cannot be undone. Are you sure?', 'Confirm Import', importCallback);
            } else {
                showNotification('Import failed: The provided data does not appear to be a valid product array.', 'Import Error');
            }
        } catch (error) {
            showNotification('Could not parse the data. Please make sure it is valid JSON and matches the required format.', 'Parsing Error');
        }
    });

    sortSelect.addEventListener('change', () => {
        renderProducts(); // Re-render the list with the new sort order
    });

    searchInput.addEventListener('input', () => {
        renderProducts(); // Re-render on every keystroke in the search bar
    });

    showExpiredOnlyFilter.addEventListener('change', () => {
        renderProducts(); // Re-render when the filter is toggled
    });

    // --- Firebase Sync Logic ---

    generateSyncCodeBtn.addEventListener('click', async () => {
        if (products.length === 0) {
            showNotification('You have no products to sync.', 'Sync Error');
            return;
        }

        // Generate a simple 6-digit random code
        const syncCode = Math.floor(100000 + Math.random() * 900000).toString();
        const syncRef = ref(db, `syncs/${syncCode}`);

        // Show loading state
        generateSyncCodeBtn.disabled = true;
        generateSyncCodeBtn.textContent = 'Generating...';

        try {
            // Create a payload with the data and a timestamp for auto-cleanup (e.g., 10 minutes)
            const payload = {
                products: products,
                createdAt: Date.now(),
                expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes from now
            };
            await set(syncRef, payload);

            // Display the code to the user
            syncCodeText.textContent = syncCode;
            syncCodeDisplay.classList.remove('hidden');
            showNotification(`Your sync code is ${syncCode}. Enter it on your other device within 10 minutes.`, 'Code Generated');

        } catch (error) {
            console.error("Firebase sync error:", error);
            showNotification('Could not generate sync code. Please check your connection and try again.', 'Firebase Error');
        } finally {
            // Reset button
            generateSyncCodeBtn.disabled = false;
            generateSyncCodeBtn.textContent = 'Generate Sync Code';
        }
    });

    syncFromCodeBtn.addEventListener('click', async () => {
        const syncCode = syncCodeInput.value.trim();
        if (!syncCode) {
            showNotification('Please enter a sync code.', 'Input Required');
            return;
        }

        // Disable the other sync button to prevent simultaneous operations
        syncFromCodeBtn.disabled = true;
        syncCodeInput.disabled = true;

        const syncRef = ref(db, `syncs/${syncCode}`);

        try {
            const snapshot = await get(syncRef);
            if (snapshot.exists()) {
                const payload = snapshot.val();
                const importedProducts = payload.products;

                const syncCallback = () => {
                    products = importedProducts;
                    saveAndRender();
                    settingsModal.classList.add('hidden');
                    showNotification(`Successfully synced ${products.length} products.`, 'Sync Complete');
                    remove(syncRef); // IMPORTANT: Delete the data from Firebase after successful sync
                };
                showNotification('This will replace all current data with the synced data. This action cannot be undone. Are you sure?', 'Confirm Sync', syncCallback);
            } else {
                showNotification('Invalid or expired sync code. Please try again.', 'Sync Failed');
            }
        } catch (error) {
            console.error("Firebase sync error:", error);
            showNotification('Could not sync data. Please check your connection and the code.', 'Firebase Error');
        } finally {
            syncFromCodeBtn.disabled = false;
            syncCodeInput.disabled = false;
        }
    });

    // --- Initial Load ---
    migrateData(); // Migrate data if necessary
    renderProducts(); // Initial render

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") { // Close any open modal on Escape key press
            modal.classList.add('hidden');
            confirmClearModal.classList.add('hidden');
            updateQuantityModal.classList.add('hidden');
            settingsModal.classList.add('hidden');
            notificationModal.classList.add('hidden');
        }
    });
});