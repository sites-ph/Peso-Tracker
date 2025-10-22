// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyD4TAbKi7iO8ZL9QRMWz2kRLCODQiil71E",
    authDomain: "pesotrackerapp.firebaseapp.com",
    projectId: "pesotrackerapp",
    storageBucket: "pesotrackerapp.appspot.com", // Corrected
    messagingSenderId: "743783019395",
    appId: "1:743783019395:web:2ba1779d279d2ffcbb3cb6",
    measurementId: "G-XY8HKHNXMZ"
};

// --- 2. INITIALIZE FIREBASE & FIRESTORE ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') console.warn('Persistence failed: multiple tabs open.');
        else if (err.code == 'unimplemented') console.warn('Persistence not available.');
    });

// --- 3. GLOBAL VARIABLES ---
// Kunin lang natin yung mga kailangan globally (modals, potentially cache)
const transactionModal = document.getElementById('transaction-modal');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmationMessageEl = document.getElementById('confirmation-message');

let onConfirmAction = null;
let allTransactionsCache = []; // Cache for CSV and maybe filtering
let balanceListenerUnsubscribe = null; // To clean up listener

// --- 4. MAIN LOGIC (RUNS ON PAGE LOAD) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded."); 
    if (document.getElementById('dashboard')) {
        console.log("Dashboard page detected. Running setup...");
        setupDashboardPage();
    } else if (document.getElementById('records-list')) {
        console.log("Records page detected. Running setup...");
        setupRecordsPage();
        // Clean up dashboard listener if active
        if (balanceListenerUnsubscribe) {
            console.log("Unsubscribing from balance listener (navigating away).");
            balanceListenerUnsubscribe();
            balanceListenerUnsubscribe = null;
        }
    } else {
        console.log("Welcome page detected.");
        // Clean up dashboard listener if active
         if (balanceListenerUnsubscribe) {
            console.log("Unsubscribing from balance listener (navigating away).");
            balanceListenerUnsubscribe();
            balanceListenerUnsubscribe = null;
        }
    }
});

// --- 5. DASHBOARD PAGE FUNCTIONS ---
function setupDashboardPage() {
    console.log("Setting up Dashboard Page listeners and balance..."); 
    
    // Get elements for this page
    const currentBalanceEl = document.getElementById('current-balance'); // Get the H1 element
    const btnShowAdd = document.getElementById('btn-show-add');
    const btnShowSubtract = document.getElementById('btn-show-subtract');
    const transactionForm = document.getElementById('transaction-form');
    const btnCancelForm = document.getElementById('btn-cancel-form'); 
    const btnConfirmNo = document.getElementById('btn-confirm-no');
    const btnConfirmYes = document.getElementById('btn-confirm-yes');

    // --- WORKING BALANCE LISTENER (FROM YOUR OLD CODE) ---
    if (currentBalanceEl) { 
        if (balanceListenerUnsubscribe) balanceListenerUnsubscribe(); // Cleanup old one
        console.log("Starting dashboard balance listener...");
        balanceListenerUnsubscribe = db.collection('transactions')
            .onSnapshot(snapshot => {
                console.log("Balance listener received update.");
                let totalAdd = 0, totalSubtract = 0;
                // Update cache here as well
                allTransactionsCache = []; 
                snapshot.forEach(doc => {
                    const t = doc.data();
                    const amount = parseFloat(t.amount); 
                    if (!isNaN(amount)) {
                         // Add Firestore Timestamp to cache if available
                         const timestamp = doc.data().transactionDate || null; 
                         allTransactionsCache.push({ id: doc.id, ...t, amount: amount, transactionDate: timestamp }); 
                        if (t.type === 'add') totalAdd += amount;
                        else if (t.type === 'subtract') totalSubtract += amount;
                    } else { console.warn("Invalid amount in doc:", doc.id, t.amount); }
                });
                const balance = totalAdd - totalSubtract;
                console.log(`Balance Calculated: ${balance}`); 
                
                // Update the H1 directly using formatLargeNumber
                currentBalanceEl.textContent = `₱${formatLargeNumber(balance)}`; 
                console.log("Dashboard balance display updated.");

            }, error => {
                console.error("Error in dashboard balance listener: ", error); 
                currentBalanceEl.textContent = "Error";
                showToast("Could not load balance.", "error");
            });
    } else { console.error("CRITICAL: 'current-balance' element not found!"); }
    
    // --- ADDED: Event Listeners (Ensure elements exist) ---
    if (btnShowAdd) btnShowAdd.addEventListener('click', () => showTransactionModal('add'));
    else console.error("CRITICAL: btnShowAdd not found!"); 
    if (btnShowSubtract) btnShowSubtract.addEventListener('click', () => showTransactionModal('subtract'));
    else console.error("CRITICAL: btnShowSubtract not found!"); 
    if (btnCancelForm) btnCancelForm.addEventListener('click', hideTransactionModal); 
    else console.warn("btnCancelForm not found!"); 
    if (transactionForm) transactionForm.addEventListener('submit', handleFormSubmit);
    else console.error("CRITICAL: transactionForm not found!"); 
    if (btnConfirmNo) btnConfirmNo.addEventListener('click', hideConfirmationModal);
    else console.warn("btnConfirmNo not found!"); 
    if (btnConfirmYes) {
        btnConfirmYes.addEventListener('click', () => { 
             console.log("Confirm Yes clicked!"); 
             if (onConfirmAction && typeof onConfirmAction === 'function') {
                 console.log("Executing onConfirmAction..."); 
                 onConfirmAction(); 
             }
             hideConfirmationModal(); 
         });
    } else { console.warn("btnConfirmYes not found!"); }
}

// --- ADDED: Format Large Numbers Function ---
function formatLargeNumber(num) {
    // Ensure num is a number
    if (typeof num !== 'number' || isNaN(num)) {
        return '0.00'; // Or some default/error value
    }
    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (absNum >= 1e9) return sign + (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (absNum >= 1e6) return sign + (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    // Use the working formatting from your old code for standard numbers
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

// --- MODAL FUNCTIONS (Copied from feature-rich version) ---
function showTransactionModal(type) {
    console.log("Showing Transaction Modal for type:", type); 
    const modalTitle = document.getElementById('modal-title');
    const transactionTypeInput = document.getElementById('transaction-type');

    if (modalTitle) modalTitle.textContent = (type === 'add') ? 'Add Money' : 'Spend Money';
    if(transactionTypeInput) transactionTypeInput.value = type;
    if(transactionModal) transactionModal.style.display = 'block';
}

function hideTransactionModal() {
    console.log("Attempting to hide Transaction Modal..."); 
    const transactionForm = document.getElementById('transaction-form'); 
    if(transactionModal) {
        transactionModal.style.display = 'none';
        console.log("Transaction Modal hidden."); 
    } else { console.warn("transactionModal element not found!"); }
    if(transactionForm) {
        transactionForm.reset();
        console.log("Transaction Form reset."); 
    }
}

function showConfirmationModal(message, onConfirm) {
    console.log("Showing Confirmation Modal with message:", message); 
    if(confirmationMessageEl) confirmationMessageEl.textContent = message;
    onConfirmAction = onConfirm; 
    if(confirmationModal) confirmationModal.style.display = 'block';
}

function hideConfirmationModal() {
    console.log("Hiding Confirmation Modal..."); 
    if(confirmationModal) {
        confirmationModal.style.display = 'none';
        console.log("Confirmation Modal hidden."); 
    } else { console.warn("confirmationModal element not found!"); }
    onConfirmAction = null; 
}

// --- Handle Form Submit (Copied + Verified from feature-rich version) ---
function handleFormSubmit(e) {
    e.preventDefault(); 
    console.log("Form Submitted!"); 

    const nameInput = document.getElementById('name');
    const amountInput = document.getElementById('amount');
    const commentInput = document.getElementById('comment');
    const transactionTypeInput = document.getElementById('transaction-type'); 
    
    const name = nameInput ? nameInput.value : '';
    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const comment = commentInput ? commentInput.value : '';
    const type = transactionTypeInput ? transactionTypeInput.value : ''; 
    const now = new Date();
    
    // Validations
    if (isNaN(amount) || amount <= 0) { showToast("Invalid amount.", "error"); return; }
    if (!name || name.trim() === '') { showToast("Name is required.", "error"); return; }
    if (type !== 'add' && type !== 'subtract') { showToast("Invalid transaction type.", "error"); return;}

    const confirmationMessage = `Are you sure you want to ${type} ₱${amount.toLocaleString('en-US')} for "${name}"?`;

    showConfirmationModal(confirmationMessage, () => {
        console.log("Confirmation received. Proceeding to save..."); 
        
        // Re-read amount and type just before saving
        const currentAmount = parseFloat(document.getElementById('amount').value);
        const currentType = document.getElementById('transaction-type').value;
        if (isNaN(currentAmount) || currentAmount <= 0) { 
             showToast("Amount invalid. Try again.", "error");
             hideConfirmationModal(); 
             return; 
        }

        const transactionData = { name, amount: currentAmount, comment, type: currentType, transactionDate: now, filterYear: now.getFullYear(), filterMonth: now.getMonth() + 1 };
        
        console.log("Saving data:", transactionData); 
        db.collection('transactions').add(transactionData)
            .then(docRef => {
                console.log("Save successful:", docRef.id); 
                // Hide transaction modal FIRST
                hideTransactionModal(); 
                // THEN show specific success toast
                const successMessage = `₱${currentAmount.toLocaleString('en-US')} successfully ${currentType === 'add' ? 'added' : 'deducted'}!`;
                showToast(successMessage, 'success'); 
                console.log("Success Toast shown."); 
            })
            .catch(error => {
                console.error("Error adding document: ", error); 
                hideTransactionModal(); 
                showToast(`Error saving: ${error.message}`, "error"); 
            });
    });
}

// --- 6. RECORDS PAGE FUNCTIONS (Copied from feature-rich version) ---
function setupRecordsPage() {
    console.log("Setting up Records Page...");
    const recordsTbody = document.getElementById('records-tbody'); 
    const btnFilter = document.getElementById('btn-filter');
    const btnExportCSV = document.getElementById('btn-export-csv');

    // Load initial records 
    if(recordsTbody) loadFilteredRecords(true); // Initial load fetches
    else console.error("CRITICAL: recordsTbody not found!"); 
    
    // Add listeners
    if(btnFilter) btnFilter.addEventListener('click', () => loadFilteredRecords(false)); // Filter fetches
    else console.warn("btnFilter not found!"); 
    if(btnExportCSV) btnExportCSV.addEventListener('click', exportDataToCSV);
    else console.warn("btnExportCSV not found!"); 
}

// Renamed from displayRecordsFromCache for clarity
function displayFetchedRecords(fetchedRecords) { 
     const recordsTbody = document.getElementById('records-tbody'); 
     if(!recordsTbody) return;
     console.log("Displaying fetched records. Count:", fetchedRecords ? fetchedRecords.length : 0);

     if (!fetchedRecords || fetchedRecords.length === 0) {
        recordsTbody.innerHTML = '<tr><td colspan="4" class="text-center">No transactions found for this period.</td></tr>';
        return;
     }

     // Sort data by date
     fetchedRecords.sort((a, b) => {
         const dateA = a.transactionDate && a.transactionDate.toMillis ? a.transactionDate.toMillis() : 0;
         const dateB = b.transactionDate && b.transactionDate.toMillis ? b.transactionDate.toMillis() : 0;
         return dateB - dateA; 
      });

     let html = '';
     fetchedRecords.forEach(data => {
         const date = data.transactionDate && data.transactionDate.toDate ? data.transactionDate.toDate() : new Date(0); 
         const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
         // Use formatLargeNumber here too
         const formattedAmount = `₱${formatLargeNumber(data.amount || 0)}`; 
         const amountClass = data.type === 'add' ? 'record-add' : 'record-subtract';
         const amountPrefix = data.type === 'add' ? '+' : '-';
         const safeName = (data.name || 'N/A').replace(/</g, "&lt;").replace(/>/g, "&gt;");
         const safeComment = (data.comment || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
         html += `<tr><td>${safeName}</td><td>${formattedDate}</td><td class="${amountClass}">${amountPrefix}${formattedAmount}</td><td>${safeComment}</td></tr>`;
     });
     recordsTbody.innerHTML = html;
}

// Fetches from Firestore - FINAL VERSION with index error handling
function loadFilteredRecords(isInitialLoad = false) { 
    const recordsTbody = document.getElementById('records-tbody'); 
    if(!recordsTbody) { console.error("Cannot filter, recordsTbody not found!"); return; }
    recordsTbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>'; 

    const monthInput = document.getElementById('filter-month');
    const yearInput = document.getElementById('filter-year');
    const month = monthInput ? monthInput.value : '';
    const year = yearInput ? yearInput.value : '';

    console.log(`Filtering Firestore by Month: ${month || 'All'}, Year: ${year || 'All'}`); 

    let query = db.collection('transactions');
    let hasFilter = false; 
    if (year) { 
        const yearNum = parseInt(year);
        if (!isNaN(yearNum)) { query = query.where('filterYear', '==', yearNum); hasFilter = true; } 
    }
    if (month) { 
        const monthNum = parseInt(month);
         if (!isNaN(monthNum)) { query = query.where('filterMonth', '==', monthNum); hasFilter = true; }
    }
    query = query.orderBy('transactionDate', 'desc'); 

    console.log("Executing Firestore query for records..."); 
    query.get()
        .then(snapshot => {
            console.log("Firestore query successful. Documents found:", snapshot.size); 
            const fetchedRecords = [];
            snapshot.forEach(doc => { fetchedRecords.push({ id: doc.id, ...doc.data() }); });
            
            // Display fetched results
            displayFetchedRecords(fetchedRecords); 

            // Show toast only when the filter button is clicked
            if (!isInitialLoad) {
                 if (hasFilter) { 
                     const monthText = month ? monthInput.options[monthInput.selectedIndex].text : 'All Months';
                    showToast(`Showing records for ${monthText} ${year || 'All Years'}.`, 'neutral');
                } else { 
                     showToast(`Showing all records.`, 'neutral'); 
                }
            }
        })
        .catch(error => { 
            console.error("Error loading filtered records: ", error); 
             recordsTbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:red;">Error: ${error.message}. Check console.</td></tr>`; 
             if (error.code === 'failed-precondition') {
                 console.error("Firestore Index Required:", error.message);
                 const urlMatch = error.message.match(/https?:\/\/[^\s]+/);
                 const indexLink = urlMatch ? urlMatch[0] : null;
                 let toastMessage = "QUERY ERROR: A database index is required. Check console (F12).";
                 if (indexLink) {
                     toastMessage = "QUERY ERROR: Click link in console (F12) to create required DB index.";
                     console.log(">>> Firestore Index Creation Link:", indexLink, "<<<"); 
                 }
                 showToast(toastMessage, "error", 10000); 
            } else { showToast("Error loading records.", "error"); }
        });
}


// --- 7. CSV EXPORT FUNCTIONS (Copied from feature-rich version) ---
function exportDataToCSV() { 
    console.log("Exporting CSV requested..."); 
    showToast("Fetching all data for export...", "neutral");

    // Fetch fresh data for export to ensure it's complete
    db.collection('transactions').orderBy('transactionDate', 'desc').get() 
        .then(snapshot => {
            const allData = [];
            snapshot.forEach(doc => allData.push({ id: doc.id, ...doc.data() }));
            console.log("Data fetched for CSV. Count:", allData.length); 
            if (allData.length === 0) { showToast("No data to export.", "neutral"); return; }
            try {
                const csv = convertToCSV(allData); 
                if (csv) {
                    downloadCSV(csv, `PesoTracker_Export_${new Date().toISOString().split('T')[0]}.csv`);
                    showToast("CSV download started!", "success");
                } else { showToast("Failed to generate CSV.", "error"); }
            } catch (error) {
                console.error("Error during CSV export:", error);
                showToast("CSV Export error. Check console.", "error");
            }
        })
        .catch(error => {
             console.error("Error fetching data for CSV export:", error);
             showToast("Could not fetch data for export.", "error");
        });
}

function convertToCSV(data) {
    if (!data || data.length === 0) return "";
    const headers = ["Date", "Name", "Type", "Amount", "Comment", "Year", "Month"]; 
    const rows = data.map(row => {
        // Handle potential missing or invalid date
        let dateStr = 'N/A';
        if (row.transactionDate && row.transactionDate.toDate) {
            try { dateStr = row.transactionDate.toDate().toLocaleDateString('en-CA'); } 
            catch (e) { console.warn("Error converting date:", row.transactionDate); }
        }
        const name = `"${(row.name || '').replace(/"/g, '""')}"`; 
        const type = row.type || '';
        const amount = row.amount || 0;
        const comment = `"${(row.comment || '').replace(/"/g, '""')}"`; 
        const year = row.filterYear || '';
        const month = row.filterMonth || '';
        return [dateStr, name, type, amount, comment, year, month].join(",");
    });
    return [headers.join(","), ...rows].join("\n");
}


function downloadCSV(csvString, filename = 'transactions.csv') { 
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url); link.setAttribute("download", filename);
        link.style.visibility = 'hidden'; document.body.appendChild(link);
        link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); 
    } else {
         try { navigator.msSaveBlob(blob, filename); showToast("CSV saved.", "success"); } 
         catch (e) { console.error("msSaveBlob failed:", e); showToast("CSV Download failed.", "error"); }
    }
 }

// --- 8. TOAST NOTIFICATION FUNCTION (Copied from feature-rich version) ---
function showToast(message, type = 'success', duration = 3000) { 
    const toast = document.getElementById('toast-notification');
    if (!toast) { console.warn('Toast element not found!'); return; }
    console.log(`Showing Toast: [${type}] ${message}`); 
    toast.textContent = message;
    toast.className = 'toast'; 
    if (type === 'success') toast.classList.add('success');
    else if (type === 'error') toast.classList.add('error');
    else if (type === 'neutral') toast.classList.add('neutral');
    toast.classList.add('show');
    if (toast.timeoutId) clearTimeout(toast.timeoutId); 
    toast.timeoutId = setTimeout(() => { 
        toast.classList.remove('show'); 
        toast.timeoutId = null; 
    }, duration); 
}