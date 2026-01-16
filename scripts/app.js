// ==================== CONFIGURATION ====================
const CONFIG = {
    WITHDRAWAL_RATE: 0.04, // 4% rule for retirement withdrawals
    DEFAULT_PROFILE: {
        // Core timeline
        currentAge: 47,
        retirementAge: 67,
        
        // Investment strategy
        currentSavings: 0,
        monthlyInvestment: 250,
        investmentReturn: 7, // Percentage (e.g., 7 for 7%)
        
        // Windfall - COMPLETELY USER-DEFINED
        windfallAmount: 10000,    // Can be $0 for no windfall
        windfallEndYear: 2030,    // Any year the user wants
        
        // Living expenses (monthly)
        rent: 1200,
        otherExpenses: 800,
        expenseInflation: 3       // Percentage
    }
};

// ==================== DATA MODEL ====================
class FinancialProfile {
    constructor(data) {
        // Deep copy to avoid reference issues
        this.currentAge = data.currentAge;
        this.retirementAge = data.retirementAge;
        this.currentSavings = data.currentSavings;
        this.monthlyInvestment = data.monthlyInvestment;
        this.investmentReturn = data.investmentReturn;
        
        // Windfall is now fully dynamic
        this.windfallAmount = data.windfallAmount;
        this.windfallEndYear = data.windfallEndYear;
        
        // Expenses
        this.rent = data.rent;
        this.otherExpenses = data.otherExpenses;
        this.expenseInflation = data.expenseInflation;
    }

    validate() {
        // Basic validation
        if (this.currentAge >= this.retirementAge) {
            throw new Error('Retirement age must be greater than current age');
        }
        if (this.investmentReturn < 0 || this.investmentReturn > 50) {
            throw new Error('Investment return must be between 0% and 50%');
        }
        if (this.windfallAmount < 0) {
            throw new Error('Windfall amount cannot be negative');
        }
        return true;
    }

    // Helper to check if windfall applies in a given year
    hasWindfallInYear(targetYear) {
        const currentYear = new Date().getFullYear();
        const yearsFromNow = targetYear - currentYear;
        const ageAtYear = this.currentAge + yearsFromNow;
        
        // Check: 1) User is still working, 2) Year is before end year, 3) Amount > 0
        return ageAtYear < this.retirementAge && 
               targetYear <= this.windfallEndYear && 
               this.windfallAmount > 0;
    }
}

// ==================== CALCULATION ENGINE ====================
class CalculationEngine {
    static project(profile) {
        profile.validate();
        
        const currentYear = new Date().getFullYear();
        const yearsToProject = profile.retirementAge - profile.currentAge;
        
        let portfolioValue = profile.currentSavings;
        const results = [];

        for (let yearOffset = 0; yearOffset <= yearsToProject; yearOffset++) {
            const currentSimulationYear = currentYear + yearOffset;
            const currentAge = profile.currentAge + yearOffset;

            // 1. Apply investment growth to existing portfolio
            portfolioValue *= (1 + profile.investmentReturn / 100);

            // 2. Add regular monthly investments for this year
            portfolioValue += profile.monthlyInvestment * 12;

            // 3. ADD WINDFALL IF APPLICABLE (DYNAMIC CHECK)
            if (profile.hasWindfallInYear(currentSimulationYear)) {
                portfolioValue += profile.windfallAmount;
            }

            // 4. Calculate inflated expenses for this year
            const inflationFactor = Math.pow(1 + profile.expenseInflation / 100, yearOffset);
            const futureMonthlyRent = profile.rent * inflationFactor;
            const futureOtherMonthly = profile.otherExpenses * inflationFactor;

            results.push({
                year: currentSimulationYear,
                age: currentAge,
                portfolio: portfolioValue,
                futureRent: futureMonthlyRent,
                futureOther: futureOtherMonthly,
                totalMonthlyExpenses: futureMonthlyRent + futureOtherMonthly,
                receivedWindfall: profile.hasWindfallInYear(currentSimulationYear)
            });
        }

        return results;
    }

    // CORRECTED: Proper 4% rule calculation (was dividing by 100 before)
    static calculateSafeWithdrawal(finalPortfolioValue) {
        const annualWithdrawal = finalPortfolioValue * CONFIG.WITHDRAWAL_RATE;
        const monthlyWithdrawal = annualWithdrawal / 12;
        return Math.round(monthlyWithdrawal);
    }

    static formatCurrency(value) {
        if (value >= 1_000_000_000) {
            return `$${(value / 1_000_000_000).toFixed(2)}B`;
        }
        if (value >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(2)}M`;
        }
        if (value >= 10_000) {
            return `$${(value / 1_000).toFixed(1)}k`;
        }
        return `$${Math.round(value).toLocaleString()}`;
    }
}

// ==================== UI MANAGER ====================
class UIManager {
    constructor() {
        this.chart = null;
        this.profile = null;
    }

    initialize() {
        this.profile = new FinancialProfile({ ...CONFIG.DEFAULT_PROFILE });
        this._renderInputs();
        this._bindEvents();
        this._updateFromInputs(); // Load initial values
        if (window.app) window.app.calculate();
    }

    _renderInputs() {
        const container = document.querySelector('.input-grid');
        if (!container) return;

        const sections = [
            {
                title: 'Timeline',
                inputs: [
                    { id: 'currentAge', label: 'Current Age', type: 'number', value: this.profile.currentAge, min: 18, max: 100 },
                    { id: 'retirementAge', label: 'Retirement Age', type: 'number', value: this.profile.retirementAge, min: 25, max: 100 }
                ]
            },
            {
                title: 'Investments',
                inputs: [
                    { id: 'monthlyInvestment', label: 'Monthly Investment ($)', type: 'number', value: this.profile.monthlyInvestment, min: 0, step: 25 },
                    { id: 'investmentReturn', label: 'Expected Return (%)', type: 'number', value: this.profile.investmentReturn, min: 0, max: 50, step: 0.1 }
                ]
            },
            {
                title: 'Additional Income',
                inputs: [
                    { id: 'windfallAmount', label: 'Annual Windfall ($)', type: 'number', value: this.profile.windfallAmount, min: 0, step: 1000 },
                    { id: 'windfallEndYear', label: 'Receiving Until Year', type: 'number', value: this.profile.windfallEndYear, min: new Date().getFullYear(), max: 2100 }
                ]
            },
            {
                title: 'Monthly Expenses',
                inputs: [
                    { id: 'rent', label: 'Rent/Housing ($)', type: 'number', value: this.profile.rent, min: 0, step: 100 },
                    { id: 'otherExpenses', label: 'Other Costs ($)', type: 'number', value: this.profile.otherExpenses, min: 0, step: 50 },
                    { id: 'expenseInflation', label: 'Annual Inflation (%)', type: 'number', value: this.profile.expenseInflation, min: 0, max: 20, step: 0.1 }
                ]
            }
        ];

        let html = '';
        sections.forEach(section => {
            html += `<div class="input-section"><h3>${section.title}</h3><div class="input-row">`;
            section.inputs.forEach(input => {
                html += `
                    <div class="input-group">
                        <label for="${input.id}">${input.label}</label>
                        <input type="${input.type}" id="${input.id}" 
                               value="${input.value}"
                               ${input.min ? `min="${input.min}"` : ''}
                               ${input.max ? `max="${input.max}"` : ''}
                               ${input.step ? `step="${input.step}"` : ''}>
                    </div>
                `;
            });
            html += `</div></div>`;
        });

        container.innerHTML = html;
    }

    _bindEvents() {
        const calculateBtn = document.getElementById('calculateBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
                this._updateFromInputs();
                if (window.app) window.app.calculate();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (window.app) window.app.reset();
            });
        }

        // Real-time updates with debouncing
        let debounceTimer;
        const updateHandler = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this._updateFromInputs();
                if (window.app) window.app.calculate();
            }, 300);
        };

        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updateHandler);
        });
    }

    _updateFromInputs() {
        if (!this.profile) return;

        this.profile.currentAge = this._getInputValue('currentAge', this.profile.currentAge);
        this.profile.retirementAge = this._getInputValue('retirementAge', this.profile.retirementAge);
        this.profile.monthlyInvestment = this._getInputValue('monthlyInvestment', this.profile.monthlyInvestment);
        this.profile.investmentReturn = this._getInputValue('investmentReturn', this.profile.investmentReturn);
        
        // DYNAMIC WINDFALL - User can change both amount and end year
        this.profile.windfallAmount = this._getInputValue('windfallAmount', this.profile.windfallAmount);
        this.profile.windfallEndYear = this._getInputValue('windfallEndYear', this.profile.windfallEndYear);
        
        this.profile.rent = this._getInputValue('rent', this.profile.rent);
        this.profile.otherExpenses = this._getInputValue('otherExpenses', this.profile.otherExpenses);
        this.profile.expenseInflation = this._getInputValue('expenseInflation', this.profile.expenseInflation);
    }

    _getInputValue(id, defaultValue) {
        const element = document.getElementById(id);
        if (!element || element.value.trim() === '') return defaultValue;
        const value = parseFloat(element.value);
        return isNaN(value) ? defaultValue : value;
    }

    updateResults(projectionData, profile) {
        const finalResult = projectionData[projectionData.length - 1];
        if (!finalResult) return;

        document.getElementById('summaryCards').innerHTML = `
            <div class="card">
                <h3>Portfolio Value</h3>
                <p class="big-number">${CalculationEngine.formatCurrency(finalResult.portfolio)}</p>
                <p class="card-sub">At age ${profile.retirementAge}</p>
            </div>
            <div class="card">
                <h3>Monthly Retirement Income</h3>
                <p class="big-number">${CalculationEngine.formatCurrency(
                    CalculationEngine.calculateSafeWithdrawal(finalResult.portfolio)
                )}</p>
                <p class="card-sub">(4% annual withdrawal)</p>
            </div>
            <div class="card">
                <h3>Future Monthly Expenses</h3>
                <p class="big-number">${CalculationEngine.formatCurrency(finalResult.totalMonthlyExpenses)}</p>
                <p class="card-sub">Adjusted for inflation</p>
            </div>
        `;

        this._updateChart(projectionData);
    }

    _updateChart(data) {
        const ctx = document.getElementById('projectionChart');
        if (!ctx) return;

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.map(d => `Age ${d.age}`),
                datasets: [
                    {
                        label: 'Investment Portfolio',
                        data: data.map(d => d.portfolio),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Annual Expenses',
                        data: data.map(d => d.totalMonthlyExpenses * 12),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                const label = context.dataset.label;
                                return `${label}: ${CalculationEngine.formatCurrency(value)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => CalculationEngine.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
}

// ==================== APP CONTROLLER ====================
class App {
    constructor() {
        this.profile = new FinancialProfile({ ...CONFIG.DEFAULT_PROFILE });
        this.ui = new UIManager();
    }

    init() {
        this.ui.initialize();
    }

    calculate() {
        try {
            const results = CalculationEngine.project(this.profile);
            this.ui.updateResults(results, this.profile);
        } catch (error) {
            console.error('Calculation error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    reset() {
        this.profile = new FinancialProfile({ ...CONFIG.DEFAULT_PROFILE });
        this.ui.profile = this.profile;
        this.ui._renderInputs();
        this.calculate();
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
