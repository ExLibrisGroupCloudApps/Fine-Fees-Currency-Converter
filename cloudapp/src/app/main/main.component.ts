import { DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import {
  AlertService,
  CloudAppEventsService,
  CloudAppRestService,
  CloudAppConfigService,
  Entity
} from "@exlibris/exl-cloudapp-angular-lib";
import { forkJoin, Observable, of, throwError } from "rxjs";
import {
  defaultIfEmpty,
  finalize,
  map,
  mergeMap,
  take,
  tap,
  catchError
} from "rxjs/operators";
import { Currencies, FineFee } from "../fine-fee.model";
import { MappingTable } from "../mappingTable";

@Component({ selector: "app-main", templateUrl: "./main.component.html", styleUrls: ["./main.component.scss"] })
export class MainComponent implements OnInit,
  OnDestroy {
  fineFees: FineFee[] = [];
  converterForm = new FormGroup({
    amount: new FormControl("", [Validators.required, Validators.min(1)]),
    sourceCurrency: new FormControl("", Validators.required),
    targetCurrency: new FormControl("", Validators.required)
  });
  @ViewChild('convertedResult') convertedResultRef: ElementRef;
  @ViewChild('errMessage') errorMessageRef: ElementRef;
  @ViewChild('selectCurrecnyErrMessage') selectCurrecnyErrMessageRef: ElementRef;
  readonly SOURCE_CURRECNY_IDETICAL_TO_TARGET_CURRECNY_ERROR: string = "Source currency is identical to target currency";
  readonly NAVIGATE_TO_A_PAGE_WITH_USER_ID_ERROR: string = "Please navigate to a page with user id";
  readonly USER_HAS_NO_FINE_TO_DISPLAY_ERROR: string = "User does not have fines/fees to display";
  readonly NAVIGATE_TO_A_PAGE_WITH_LIST_OF_FINES_ERROR: string = "Please navigate to a page with list of fine/fees";
  readonly AUTHORIZED_ERROR_MESSAGE: string = "You do not have the required privileges to use this app";
  isAuthorizedUser: boolean;
  selectedEntities = new Array<FineFee>();
  convertTypeSelected: ConvertType = ConvertType.CONVERT_USER_FEES;
  ConvertTypeOptions = ConvertType;
  sourceAmount: string;
  convertedAmount: string;
  errorMessage: string;
  selectedCurrecnyerrorMessage: string;
  supportedCurrencies: string[] = [];
  defaultCurrency: string;
  selectedCurrency: string;
  loading = true;
  userActiveBlance: string;
  fineFeeEntities$: Observable<FineFee[]>;
  _count = 0;
  decimalDigits: number;
  readonly config = { attributes: true, childList: true, subtree: true };
  readonly DEF_DECIMAL_DIGITS : number = 2;

  // Callback function to execute when mutations are observed
  callbackConvertedResultRef = (mutationList, observer) => {
    this.convertedResultRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    //stop observing
    observer.disconnect();
  };

  callbackErrorMessageRef = (mutationList, observer) => {
    this.errorMessageRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    //stop observing
    observer.disconnect();
  };

  callbackSelectCurrencyErrorMessageRef = (mutationList, observer) => {
    this.selectCurrecnyErrMessageRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    //stop observing
    observer.disconnect();
  };

  readonly observerConvertedResultRef = new MutationObserver(this.callbackConvertedResultRef);

  readonly observerErrorMessageRef = new MutationObserver(this.callbackErrorMessageRef);

  readonly observerSelectCurrencyErrorMessageRef = new MutationObserver(this.callbackSelectCurrencyErrorMessageRef);

  constructor(private eventService: CloudAppEventsService, private restService: CloudAppRestService, private eventsService: CloudAppEventsService, public configService: CloudAppConfigService, private alert: AlertService, private formBuilder: FormBuilder, private datePipe: DatePipe) { }

  ngOnInit() {
    this.initData();
    this.eventService.entities$.subscribe(() => this.isAuthorizedUser && this.onConvertTypeChange());
  }

  updateSelectedCurrency(currecny: string) {
    this.selectedCurrency = currecny;
  }

  initData() {
    this.restService.call("/almaws/v1/conf/mapping-tables/CurrencySubset").pipe(tap((res: MappingTable) => {
      if (res?.row) {
        res.row.forEach((element) => {
          if ("TRUE" === element.column1) {
            this.defaultCurrency = element.column0;
          }
          if (element.enabled) {
            this.supportedCurrencies.push(element.column0);
          }
        });
        this.supportedCurrencies.sort();
      }
    }), mergeMap(() => {
      return this.configService.get().pipe(tap(response => {
        if( Object.keys(response).length === 0){
          console.log("Use the default config ");
          this.decimalDigits = this.DEF_DECIMAL_DIGITS;
        }
        else{
          console.log("Got the config:", response);
          this.decimalDigits = response;
        }
      }, err => {
        console.log("ERROR while loading the confguration", err.message);
        this.decimalDigits = this.DEF_DECIMAL_DIGITS;
      }))
    })).subscribe((res) => {
      this.isAuthorizedUser = true;
      this.onConvertUserFees();
    }, (err) => {
      this.isAuthorizedUser = false;
      this.loading = false;
      console.log(err.message);
    });;
  }

  set count(val: number) {
    this._count = val;
  }

  get count() {
    return this._count;
  }

  ngOnDestroy(): void { }

  onConvertTypeChange() {
    this.clearFields();
    switch (this.convertTypeSelected) {
      case ConvertType.CONVERT_USER_FEES_IN_ALMA_PAGE:
        {
          this.onConvertUserFeesInAlmaPage();
          break;
        }
      case ConvertType.CONVERT_USER_FEES:
        {
          this.onConvertUserFees();
          break;
        }
      case ConvertType.CONVERT_SPECIFIC_AMOUNT:
        {
          this.onConvertSpecificAmount();
          break;
        }
      case ConvertType.CONVERT_USER_ACTIVE_BALANCE:
        {
          this.onConvertUserActiveBalance();
          break;
        }
    }
  }

  clearFields() {
    this.fineFees = [];
    this.selectedEntities = [];
    this._count = 0;
    this.convertedAmount = null;
    this.sourceAmount = null;
    this.fineFeeEntities$ = null;
    this.selectedCurrency = null;
    this.errorMessage = null;
    this.selectedCurrecnyerrorMessage = null;
    this.converterForm.reset();
    this.loading = true;
  }

  onConvertSpecificAmount() {
    this.loading = false;
  }

  onConvertUserActiveBalance() {
    this.getUserActiveBalnce();
  }

  refreshActiveBalance() {
    this.getUserActiveBalnce();
  }

  convertUserActiveBalance() {
    this.performCurrencyConvert(this.defaultCurrency, this.selectedCurrency, parseFloat(this.userActiveBlance));
  }

  getUserActiveBalnce() {
    this.eventsService.entities$.pipe(take(1), map((entities) => {
      const entity = entities.filter((entity) => entity?.type === "USER");
      if (entity.length > 0)
        return entity[0];
    }), mergeMap((entity) => !!entity ? this.restService.call(entity?.link + "/fees") : of(null)), map((full) => {
      if (full?.total_sum === 0)
        this.userActiveBlance = full.total_sum;
      else
        this.userActiveBlance = full?.total_sum ?? null;
    }), catchError((error) => {
      console.log(error);
      return error
    }), finalize(() => {
      this.loading = false;
      if (this.userActiveBlance == null) {
        this.errorMessage = this.NAVIGATE_TO_A_PAGE_WITH_USER_ID_ERROR;
      }
    })).subscribe();
  }

  onConvertUserASpecificAmount() {
    this.loading = false;
  }

  convertSpecificAmount() {
    if (this.converterForm.valid) {
      const sourceCurrency = this.converterForm.controls.sourceCurrency.value;
      const targetCurrency = this.converterForm.controls.targetCurrency.value;
      const amount = this.converterForm.controls.amount.value;
      this.performCurrencyConvert(sourceCurrency, targetCurrency, amount);
    }
  }

  onConvertUserFeesInAlmaPage() {
    this.loading = true;
    this.eventsService.entities$.pipe(take(1), map((entities) => {
      const filteredEntities = entities.filter((entity) => {
        let curEntity = entity?.type + '';
        return curEntity === "FEES"
      });
      return filteredEntities;
    }), mergeMap((entities) => forkJoin(entities.map((e) => this.restService.call(e.link))).pipe(defaultIfEmpty([]))), map((fees) => {
      fees.map((fine) => {
        fine.description = this.getFineFeeToDisplay(fine);
      });
      this._count = fees.length;
      if (this._count === 0)
        this.errorMessage = this.NAVIGATE_TO_A_PAGE_WITH_LIST_OF_FINES_ERROR;
      return fees;
    }), finalize(() => {
      this.loading = false;
    })).subscribe((data) => {
      this.fineFeeEntities$ = of(data);
    }, (error) => {
      console.log(error);
    });
  }

  onConvertUserFees() {
    this.eventsService.entities$.pipe(take(1), map((entities) => {
      const entity = entities.filter((entity) => entity?.type === "USER");
      return (entity.length > 0) ? entity[0] : undefined;
    }), mergeMap((entity) => { return (entity != undefined) ? of(entity) : throwError("Please navigate to a page with user id") }), mergeMap((entity) => !!entity ? this.restService.call(entity?.link + "/fees") : of(null)), map((full) => {
      return full?.fee ?? [];
    }), map((fees: FineFee[]) => {
      fees.map((fine) => {
        fine.description = this.getFineFeeToDisplay(fine);
      });
      this._count = fees.length;
      if (this._count == 0) {
        this.errorMessage = this.USER_HAS_NO_FINE_TO_DISPLAY_ERROR;
      }
      return fees;
    }), catchError((error) => {
      console.log(error);
      this.errorMessage = this.NAVIGATE_TO_A_PAGE_WITH_USER_ID_ERROR;
      return of(null)
    }), finalize(() => {
      this.loading = false;
    })).subscribe((data) => {
      this.fineFeeEntities$ = of(data);
    }, (error) => {
      console.log(error);
    });
  }

  getFineFeeToDisplay(fine: FineFee): string {
    return fine.type.desc + ", Owner: " + fine.owner.desc + (fine.title != null ? ", Title: " + fine.title : "") + ",\nBalance: " + fine.balance + " " + this.defaultCurrency;
  }

  onSelectionTargetCurrecny() {
    const sourceCurrency = this.convertTypeSelected != ConvertType.CONVERT_SPECIFIC_AMOUNT ? this.defaultCurrency : this.converterForm.controls.sourceCurrency?.value;
    const targetCurrency = this.convertTypeSelected != ConvertType.CONVERT_SPECIFIC_AMOUNT ? this.selectedCurrency : this.converterForm.controls.targetCurrency?.value;
    if (sourceCurrency === targetCurrency) {
      this.selectedCurrecnyerrorMessage = this.SOURCE_CURRECNY_IDETICAL_TO_TARGET_CURRECNY_ERROR;
      this.observerSelectCurrencyErrorMessageRef.observe(this.selectCurrecnyErrMessageRef.nativeElement, this.config);
      this.sourceAmount = null;
      this.convertedAmount = null;
    } else
      this.selectedCurrecnyerrorMessage = null;
  }

  convertUserFeesInAlmaPage() {
    let totalAmount: number = 0;
    this.selectedEntities.forEach((element) => {
      totalAmount += element.balance;
    });
    this.performCurrencyConvert(this.defaultCurrency, this.selectedCurrency, totalAmount);
  }

  private performCurrencyConvert(sourceCurrency: string, targetCurrency: string, amount: number) {
    this.sourceAmount = null;
    this.convertedAmount = null;
    this.errorMessage = null;
    let currentDate: string = this.datePipe.transform(new Date(), "yyyyMMdd");
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayDate = this.datePipe.transform(yesterday, "yyyyMMdd");

    this.restService.call("/almaws/v1/acq/currencies?mode=Ratio&source_currency=" + sourceCurrency + "&target_currency=" + targetCurrency + "&exchange_date=" + currentDate).pipe(catchError(err => {
      return this.restService.call("/almaws/v1/acq/currencies?mode=Ratio&source_currency=" + sourceCurrency + "&target_currency=" + targetCurrency + "&exchange_date=" + yesterdayDate)
    })).subscribe((currenciesResponce: Currencies) => {
      if (currenciesResponce?.currency.length > 0) {
        let exchangeRatio: number = currenciesResponce.currency[0]?.exchange_ratio.value;
        if (exchangeRatio) {
          this.sourceAmount = amount.toString() + " " + sourceCurrency;
          this.convertedAmount = (Math.round(exchangeRatio * amount * 100) / 100).toFixed(this.decimalDigits).toLocaleString() + " " + targetCurrency;
          // Start observing the target node for configured mutations
          this.observerConvertedResultRef.observe(this.convertedResultRef.nativeElement, this.config);
        }
      }
    }, (error) => {
      console.log(error);
      this.errorMessage = "Failed to convert fines/fees";
      this.observerErrorMessageRef.observe(this.errorMessageRef.nativeElement, this.config);
    });
  }

}
export enum ConvertType {
  CONVERT_SPECIFIC_AMOUNT = "CONVERT_SPECIFIC_AMOUNT",
  CONVERT_USER_FEES_IN_ALMA_PAGE = "CONVERT_USER_FEES_IN_ALMA_PAGE",
  CONVERT_USER_ACTIVE_BALANCE = "CONVERT_USER_ACTIVE_BALANCE",
  CONVERT_USER_FEES = "CONVERT_USER_FEES"
}
