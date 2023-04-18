export interface FineFee { 
      id: string;
      type: Type;
       status: string;
      user_primary_id: string;
      balance: number;
      remaining_vat_amount: string;
      creation_time: string;
      status_time: string;
      comment: string;
      owner: Owner;
      title:string;
      barcode:string;
      description: string;
      link: string;
  }

  export interface FineFees { 
    fee :FineFee[];
}

  export interface Owner {
    value: string;
    desc?: string;
  }

  export interface Type {
    value: string;
    desc?: string;
  }

  export interface Currency {
    source_currency: string;
    name: string;
    target_currency: string;
    exchange_ratio: ExchangeRatio;
  }

  export interface Currencies {
    total_record_count: string;
    currency: Currency[];
  }

  export interface ExchangeRatio {
    value: number;
  }

  export interface KeyValue { 
    value: String ;
    desc: String ;
  }
