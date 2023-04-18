import {Router} from "@angular/router";
import {forkJoin, throwError} from "rxjs";
import {AlertService, CloudAppConfigService, RestErrorResponse} from "@exlibris/exl-cloudapp-angular-lib";
import {Component, OnInit} from "@angular/core";
import {mergeMap, finalize} from "rxjs/operators";

@Component({selector: "app-config", templateUrl: "./config.component.html", styleUrls: ["./config.component.scss"]})
export class ConfigComponent implements OnInit {
    loading : boolean = true;
    config : Object;
    decimalDigits : number;
    readonly DEF_DECIMAL_DIGITS : number = 2;

    constructor(private configService : CloudAppConfigService, private alert : AlertService, private router : Router) {}

    ngOnInit(): void {
        this.load();
    }

    load() {
        this.configService.get().pipe(finalize(() => this.loading = false)).subscribe({
            next: (config : number) => (this.decimalDigits = config),
            error: (err : RestErrorResponse) => {
                this.alert.error("There was an error loading the configuration , please try again");
                console.error(err);
            }
        });

    }

    onSave(): void {
        this.loading = true;
        this.configService.set(this.decimalDigits).subscribe({
            next: () => {},
            error: (err : RestErrorResponse) => {
                this.loading = false;
                this.alert.error(`Could not saved configuration, Error : ${ err.message}}`);
                console.error(err);
            },
            complete: () => {
                this.alert.success("Successfully saved settings", {keepAfterRouteChange: true});
                this.loading = false;
                this.router.navigate([""]);
            }
        });
    }

    onRestoreDef(): void {
        this.decimalDigits = this.DEF_DECIMAL_DIGITS;
        this.onSave();
    }

}
