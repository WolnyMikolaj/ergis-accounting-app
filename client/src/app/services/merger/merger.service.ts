import { Injectable, computed, signal } from '@angular/core';
import { FinalMergerObject, MergerObject } from './merger.types';

@Injectable({
    providedIn: 'root',
})
export class MergerService {
    private readonly _negativesData = signal<string>('');
    private readonly _negativesDataJson = computed<MergerObject[]>(() => {
        try {
            const json = JSON.parse(this._negativesData());
            return json;
        } catch (err) {
            return [];
        }
    });

    readonly negativesData = computed(() => this._negativesData());
    readonly isNegativeDataValid = computed(() => this._negativesDataJson()?.length > 0);

    setNegativesData(data: string): void {
        this._negativesData.set(data);
    }

    public processData(addedPositives: MergerObject[], addedNegatives: MergerObject[]) {
        if (!addedPositives) return null;
        try {
            const pastNegatives = JSON.parse(this.negativesData()) ?? [] as MergerObject[];
            const negatives = [...pastNegatives, ...(addedNegatives ?? [])];
            return this._processData(addedPositives ?? [], negatives);
        } catch (err) {
            return null;
        }
    }

    private _processData(positives: MergerObject[], negatives: MergerObject[]): [FinalMergerObject[], MergerObject[]] {
        if (negatives.length == 0) return [[], []];
        negatives = negatives.map(v => ({
            ...v,
            kwotaWWalucie: -v.kwotaWWalucie,
            kwotaWZł: -v.kwotaWZł,
        }));

        let positiveObject: MergerObject = positives.shift()!;
        let negativeObject: MergerObject = negatives.shift()!;

        let positiveAmount: number = positiveObject?.kwotaWWalucie;
        let negativeAmount: number = negativeObject.kwotaWWalucie;

        if (positives.length == 0) {
            const negativeExchangeRate = negativeObject.kwotaWZł / negativeObject.kwotaWWalucie;
            negatives = this._retrieveUnusedNegatives(negativeAmount, negatives, negativeExchangeRate);
            return [[], negatives];
        }

        const allCurrencyCorrections: FinalMergerObject[] = [];

        while ((positives.length > 0 || !isNaN(positiveAmount)) && negatives.length > 0) {
            const negativeExchangeRate = negativeObject.kwotaWZł / negativeObject.kwotaWWalucie;
            const positiveExchangeRate = positiveObject.kwotaWZł / positiveObject.kwotaWWalucie;

            const referencjaKG = positiveObject.referencjaKG;
            let correctionAmount: number;
            if (positiveAmount >= negativeAmount) {
                correctionAmount = negativeAmount;
                positiveAmount -= negativeAmount;

                negativeObject = negatives.shift()!;
                negativeAmount = negativeObject?.kwotaWWalucie ?? NaN;
            }
            if (positiveAmount <= negativeAmount) {
                correctionAmount ||= positiveAmount;
                negativeAmount -= positiveAmount;

                positiveObject = positives.shift()!;
                positiveAmount = positiveObject?.kwotaWWalucie ?? NaN;
            }
            const currencyCorrection = correctionAmount! * (negativeExchangeRate - positiveExchangeRate);

            allCurrencyCorrections.push({
                referencjaKG,
                currencyCorrection,
            });
        }
        const negativeExchangeRate = negativeObject.kwotaWZł / negativeObject.kwotaWWalucie;
        negatives = this._retrieveUnusedNegatives(negativeAmount, negatives, negativeExchangeRate);

        return [allCurrencyCorrections, negatives];
    }

    private _retrieveUnusedNegatives(negativeAmount: number, negativeArray: MergerObject[], negativeExchangeRate: number) {
        const kwotaWZł = negativeExchangeRate * negativeAmount;

        negativeArray.unshift({
            referencjaKG: 'NieUżytyElement',
            naDzien: 'NieUżytyElement',
            kwotaWWalucie: negativeAmount,
            kwotaWZł,
            korekta: 'Nie',
        });
        return negativeArray;
    }
}
