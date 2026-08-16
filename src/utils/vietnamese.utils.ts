export function removeVietnameseAccents(str: string): string {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

export function buildVietnameseRegex(keyword: string): RegExp {
    const cleanStr = keyword.trim().toLowerCase();
    if (!cleanStr) return new RegExp("", "i");

    let pattern = "";
    for (const char of cleanStr) {
        switch (char) {
            case "a":
                pattern += "[aáàảãạâấầẩẫậăắằẳẵặAÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶ]";
                break;
            case "e":
                pattern += "[eéèẻẽẹêếềểễệEÉÈẺẼẸÊẾỀỂỄỆ]";
                break;
            case "i":
                pattern += "[iíìỉĩịIÍÌỈĨỊ]";
                break;
            case "o":
                pattern += "[oóòỏõọôốồổỗộơớờởỡợOÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ]";
                break;
            case "u":
                pattern += "[uúùủũụưứừửữựUÚÙỦŨỤƯỨỪỬỮỰ]";
                break;
            case "y":
                pattern += "[yýỳỷỹỵYÝỲỶỸỴ]";
                break;
            case "d":
                pattern += "[dđDĐ]";
                break;
            default:
                if (/[.*+?^${}()|[\]\\]/.test(char)) {
                    pattern += `\\${char}`;
                } else {
                    pattern += char;
                }
                break;
        }
    }

    return new RegExp(pattern, "i");
}
