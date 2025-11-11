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

    // Generic Notification Modal elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationActions = document.getElementById('notification-actions');


    // --- State Management ---
    let products = JSON.parse(localStorage.getItem('products')) || [];

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

        if (searchTerm) {
            filteredProducts = products.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                product.barcode.toLowerCase().includes(searchTerm)
            );
        }

        const sortBy = sortSelect.value;

        if (sortBy === 'expiryDate') {
            // Sort by expiry date, with the nearest date at the top
            filteredProducts.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        } else if (sortBy === 'registrationDate') {
            // Sort by registration ID (timestamp), oldest first
            filteredProducts.sort((a, b) => a.id - b.id);
        }

        filteredProducts.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'product-item';
            productItem.dataset.id = product.id;

            // Format date for display
            const [year, month, day] = product.expiryDate.split('-'); // This can fail if date is invalid
            const displayDate = `${day}/${month}/${year}`;

            // --- Expiry Status Logic ---
            const today = new Date();
            const expiryDate = new Date(product.expiryDate);
            // Reset time to 00:00:00 for accurate day comparison
            today.setHours(0, 0, 0, 0);
            expiryDate.setHours(0, 0, 0, 0);

            const timeDiff = expiryDate.getTime() - today.getTime();
            const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (dayDiff < 0) {
                productItem.classList.add('expired');
            } else if (dayDiff <= 7) {
                productItem.classList.add('expiring-soon');
            }

            productItem.innerHTML = /*html*/`
                <div class="product-details">
                    <p><strong>Product:</strong> ${product.name}</p>
                    <p><strong>Quantity:</strong>
                        <span class="quantity-control">
                            <button class="quantity-btn decrease-quantity" title="Decrease Quantity">-</button>
                            <span class="product-quantity">${product.quantity}</span>
                            <button class="quantity-btn increase-quantity" title="Increase Quantity">+</button>
                        </span>
                    </p>
                    <p><strong>Expiring Date:</strong> ${displayDate}</p>
                    <p><strong>IBN:</strong> ${product.barcode}</p>
                </div>
                <div class="product-actions">
                    <svg class="barcode-svg"></svg>
                    <button class="delete-btn" title="Delete Product"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;

            productListDiv.appendChild(productItem);

            // Generate barcode for the item
            JsBarcode(productItem.querySelector('.barcode-svg'), product.barcode, {
                format: "CODE128",
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

        // Pad day and month with a leading zero if needed
        const day = expiryDayInput.value.padStart(2, '0'); // This was missing its declaration
        const month = expiryMonthInput.value.padStart(2, '0');
        const year = expiryYearInput.value;
        const isoDate = `${year}-${month}-${day}`;

        const barcode = barcodeInput.value.trim();
        const existingProduct = products.find(p => p.barcode === barcode);

        if (existingProduct) {
            if (existingProduct.expiryDate === isoDate) {
                // Same barcode, same date -> ask to update quantity
                pendingProduct = { existingProduct, quantityToAdd: quantityInput.value };
                updateQuantityModal.classList.remove('hidden');
                modal.classList.add('hidden'); // Hide the add form
            } else {
                // Same barcode, different date -> notify and add as new
                showNotification('A product with this barcode but a different expiry date already exists. A new item will be created.', 'Notice');
                addNewProduct(isoDate, barcode); // Still add the product after notifying
            }
        } else {
            // No existing product -> add as new
            addNewProduct(isoDate, barcode);
        }
    });

    function addNewProduct(isoDate, barcode) {
         const newProduct = {
             id: Date.now(),
             name: productNameInput.value,
             quantity: quantityInput.value,
             expiryDate: isoDate,
             barcode: barcode
         };
         products.push(newProduct);
         saveAndRender();
         modal.classList.add('hidden');
    }

    function saveAndRender() {
        saveProducts(); 
        renderProducts();
        productForm.reset();
    }

    confirmUpdateBtn.addEventListener('click', () => {
        const { existingProduct, quantityToAdd } = pendingProduct;
        existingProduct.quantity = parseInt(existingProduct.quantity) + parseInt(quantityToAdd);
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
            const productToDelete = products.find(p => p.id === productId);

            if (productToDelete) {
                const deleteCallback = () => {
                    products = products.filter(product => product.id !== productId);
                    saveAndRender();
                };
                showNotification(`Are you sure you want to delete "${productToDelete.name}"?`, 'Confirm Deletion', deleteCallback);
            }
        } else if (increaseBtn) {
            const productItem = increaseBtn.closest('.product-item');
            const productId = Number(productItem.dataset.id);
            const product = products.find(p => p.id === productId);
            product.quantity = parseInt(product.quantity) + 1;
            saveAndRender();
        } else if (decreaseBtn) {
            const productItem = decreaseBtn.closest('.product-item');
            const productId = Number(productItem.dataset.id);
            const product = products.find(p => p.id === productId);
            if (product.quantity > 1) {
                product.quantity = parseInt(product.quantity) - 1;
                saveAndRender();
            }
            // Optional: Ask to delete if quantity becomes 0
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


    // --- Initial Load ---
    renderProducts();

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