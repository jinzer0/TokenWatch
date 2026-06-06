export type PriceModel = {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number;
};

export const defaultPrices: PriceModel[] = [
  {
    provider: 'openai',
    model: 'gpt-5.5',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10,
    cachedInputPricePerMillion: 0.125
  },
  {
    provider: 'openai',
    model: 'gpt-5.5-fast',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 2,
    cachedInputPricePerMillion: 0.025
  },
  {
    provider: 'openai',
    model: 'gpt-4.1',
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    cachedInputPricePerMillion: 0.5
  },
  {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 1.6,
    cachedInputPricePerMillion: 0.1
  }
];
