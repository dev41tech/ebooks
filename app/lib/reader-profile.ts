export type ReaderProfile={city:string;region:string;language:string;genres:string;bio:string};
export function cleanReaderProfile(value:unknown):ReaderProfile{
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const field=(key:string,max:number)=>typeof data[key]==='string'?(data[key] as string).trim().slice(0,max):'';
 return {city:field('city',80),region:field('region',80),language:field('language',30),genres:field('genres',200),bio:field('bio',500)};
}
