# vue-blob-forms

`vue-blob-forms` is a simple frontend web form validation plugin for [Vue JS](https://vuejs.org/). It relies on the native HTML5 [Constraint API](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/Constraint_validation), and is compatible with any custom constraints (`v-bind:` or otherwise) your code might contain.

&nbsp;

## Table of Contents

 * [Installation](#installation)
 * [Form and Field Validation](#form-and-field-validation)
 * [Phone Number Formatting](#phone-number-formatting)
 * [blob-select](#blob-select)
 * [Gravatar](#gravatar)
 * [License](#license)

&nbsp;

## Installation

`vue-blob-forms` requires [Vue 2+](https://github.com/vuejs/vue).

Advanced phone number validation and formatting (if so desired) requires [blob-phone JS](https://github.com/Blobfolio/blob-phone#javascript).

To use it, simply include it in your project after the dependencies:

```html
<script src="path/to/vue.js"></script>
<script src="dist/vue-blob-forms.min.js"></script>
```

&nbsp;

## Form and Field Validation

### Directive: v-form

This directive provides the bulk of `vue-blob-forms`'s goodies. Simply add `v-form` to any HTML `<form>` element to enable validation and all the related methods.

Name attributes are required for all forms and form fields. Any element without a name will be ignored by the validation process.

#### Example

```html
<form name="myForm" v-form>
    ...
</form>
```


### Ignoring Specific Fields

By default, all fields within a `<form>` element are expected to validate according to their rules.

If you need to exempt a field — perhaps because it serves some other Javascripty purpose — simply add a `novalidate-field` attribute to the element and it will be skipped.


### Method: formErrors()

This method can be used to retrieve all errors for a given form, or an error for a single form field.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |
| *string* (optional) | fieldName | The name of the field. |

#### Returns

When only `formName` is passed, the method will return all form errors, or `FALSE` if there are none. Errors are returned as an object, each key representing `fieldName` and each value an error string.

When `fieldName` is passed, the method will return the error corresponding to the field, or `FALSE` if there is no error.

#### Example

```html
<div v-if="false !== formErrors('myForm', 'myField')" class="error">
    {{ formErrors('myForm', 'myField') }}
</div>
```


### Method: formOtherErrors()

This method returns any errors *not* corresponding to field names, or `FALSE` if there are none.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |

#### Returns

This method returns any errors *not* corresponding to field names, or `FALSE` if there are none.

#### Example

```html
<div v-if="false !== formOtherErrors('myForm')" v-for="(error, key) in formOtherErrors('myForm')" class="error">
    {{ key }}: {{ error }}
</div>
```


### Method: setFormErrors()

This method can be used to set arbitrary form errors. The errors do not necessarily need to correspond to a field, but the form must be a valid `v-form` element.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |
| *object* | errors | An object with keys relating to fields or error codes, and values being errors strings. |

#### Returns

This method will update the form errors and return `TRUE`, or `FALSE` if bad arguments were passed.

#### Example

```javascript
var errors = {
    fieldOne: 'This is all wrong.',
    fieldTwo: 'This too is not correct.',
};
this.setFormErrors('myForm', errors);
```


### Method: clearFormErrors()

This method can be used to quickly unset all errors for a form.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |

#### Returns

This method will clear the form errors and return `TRUE`, or `FALSE` if bad arguments were passed.

#### Example

```javascript
this.clearFormErrors('myForm');
```


### Method: formTouched()

This method can be used to determine whether or not a form or a specific field has been "touched".

For the purposes of this plugin, a "touch" occurs when a field receives input or when the field's `blur` event triggers.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |
| *string* (optional) | fieldName | The name of the field. |

#### Returns

When only `formName` is passed, the method returns `TRUE` if any of its fields have been touched, otherwise `FALSE`.

When `fieldName` is passed, `TRUE` or `FALSE` are returned based on the state of the specific field.

#### Example

```html
<input type="text" v-bind:class="{ touched: formTouched('myForm', 'myField') }" name="myField" />
```


### Method: formChanged()

This method works just like [formTouched()](#method-formtouched), but says whether or not field values have changed since the form was first initialized.


### Method: formValid()

This method works just like [formTouched()](#method-formtouched), but says whether or not field values are valid.

Note: during automatic validation, if a field is required _and_ empty, it will only trigger an invalid state _if_ it has been touched. Because of this, it is recommended you call the [validateForm()](#method-validateform) method prior to submission, which will force-touch all fields and rerun validation accordingly.


### Method: validateForm()

This method force-touches all form fields, reruns validation, and returns `TRUE` if everything is happy, or `FALSE` if one or more fields are sad.

#### Arguments

| Type | Name | Description |
| ---- | ---- | ----------- |
| *string* | formName | The name of the form. |

#### Returns

`TRUE` if all form fields are valid, otherwise `FALSE`.

Note: `FALSE` is also returned if the form name is invalid or not bound to the `v-form` directive. In other words, this should only be used for `v-form` forms.

#### Example

```html
<form v-form name="myForm" v-on:submit.prevent="submitForm">
    ...
</form>
```

```javascript
submitForm = function() {
    if (!this.validateForm('myForm')) {
        return false;
    }

    // Submit the form...
}
```


### Custom Validation Callbacks

Aside from the standard [Constraints](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/Constraint_validation) like `required` and `minlength` and whatnot, you can also specify any arbitrary Vue callback function by adding `data-validation-callback="myVueMethod"` to a field.

The callback function must be within the Vue scope and should accept a single argument representing the field value.

If the value is valid, the function should return `TRUE`, otherwise it should return an error string.

#### Example

```html
<input type="text" validation-callback="validateUsername" />
```

```javascript
validateUsername = function(value) {
    if (this.users.indexOf(value) !== -1) {
        return true;
    }

    return 'Please enter a valid user name.';
}
```


### Form Classes

All forms with the `v-form` directive receive the following classes to aid with state-based styling or DOM queries:

| Class | Description |
| ----- | ----------- |
| is-valid | All fields are valid*. |
| is-invalid | One or more fields are invalid. |
| is-touched | One or more fields have been touched. |
| is-changed | One or more fields have different values from the ones at load time. |

Note: during automatic validation, if a field is required _and_ empty, it will only trigger an invalid state _if_ it has been touched. Because of this, it is recommended you call the [validateForm()](#method-validateform) method prior to submission, which will force-touch all fields and rerun validation accordingly.

&nbsp;

## Phone Number Formatting

`vue-blob-forms` comes with wrappers for [blob-phone JS](https://github.com/Blobfolio/blob-phone#javascript). To reduce overhead, `blob-phone` itself is not included; if missing, these directives and methods will have no effect.

### Directive: v-phone

This directive should be applied to an `<input type="tel" />` field. Phone numbers entered will then be validated according to the country's formatting rules, and rewritten into international standard (e.g. from `(123) 456-7890` to `+1 123-456-7890`).

The directive optionally takes an ISO country code as an argument, which serves as the default country for validation/formatting purposes. Because a single, unformatted number might match multiple regions around the globe, it is highly recommended an appropriate country code be passed. If blank or invalid, `US` is assumed.

If a phone number is valid, the model will be set to the formatted value. The country code will also be appended to the `DOMElement`'s `data-country` attribute, in case you wanted to style the input with a flag or something.

#### Example

```html
<input type="tel" name="myPhone" v-phone="CA" />
```

### Filter: phone

Format an arbitrary phone-like string to an international standard.

Note: this can be used independently of any form or field elements.

#### Arguments

| Type | Name | Description | Default |
| ---- | ---- | ----------- | ------- |
| *string* | phone | Phone number. | |
| *string* (optional) | country | A country code. | `US` |

#### Returns

If the phone number is valid and parseable, it will be returned in internationalized format. Otherwise the original value is returned.

#### Example

```html
<div class="phone">
    Phone Number: {{ myPhone | phone('GB') }}
</div>
```

&nbsp;

## blob-select

`vue-blob-forms` comes with a wrapper for [blob-select](https://github.com/Blobfolio/blob-select). To use this feature, download and add the `blob-select` library to your project.

### Directive: v-blobselect

Normally, `blob-select` is initialized on an element because it includes a `data-blobselect` attribute. To do it the Vue way, replace that with `v-blobselect`.

Note: if the element is conditionally rendered via `v-if`, etc., you will probably need to add a unique `key` attribute to the `<SELECT>` field's parent container, otherwise Vue's cache will get confused.

```html
<div v-if="showingSelect" key="myFirstSelect">
    <select name="myFirstSelect" v-blobselect></select>
</div>
```

#### Arguments

The following optional arguments can be passed with the directive to alter the behavior of the element:

| Type | Name | Description | Default |
| ---- | ---- | ----------- | ------- |
| *string* | orderType | Resort options based on their values. Can be `string` or `numeric`. | `NULL` (no sorting) |
| *string* | order | Sort `ASC` or `DESC`. Only applies if `orderType` is set. | `ASC` |
| *string* | placeholder | Text to display when no value is selected. | `---` |
| *string* | placeholderOption | Text to use for the placeholder dropdown label. | `---` |
| *bool* | search | Enable search. | `FALSE` |
| *int* | watch | Check for DOM changes every X milliseconds and repaint if needed. | `0` (disabled) |
| *bool* | debug | Print event activity to the console log. | `FALSE` |

#### Example

```html
<select v-blobselect="{placeholder: 'Choose Something'}">
    ...
</select>
```

&nbsp;

## Gravatar

`vue-blob-forms` comes with a couple [Gravatar](https://en.gravatar.com/) helpers in case you wanted to personalize email entries.

### Directive: v-gravatar

This directive will automatically apply an email address' corresponding Gravatar icon as a background image on a `<input type="email" />` field.

The directive optionally takes a single argument representing the icon size to return. The default is `80` (pixels).

If an address is invalid or has no Gravatar image, the result will be blank (a transparent PNG).

#### Example

```html
<input type="email" v-gravatar="40" />
```

### Method: gravatarURL()

Find a Gravatar image URL for a given email address.

#### Arguments

| Type | Name | Description | Default |
| ---- | ---- | ----------- | ------- |
| *string* | email | Email address. | |
| *string* (optional) | Size | The pixel size to return. | `80` |

#### Returns

A URL from Gravatar is always returned. If the email address is invalid or not part of Gravatar, the URL will resolve to a transparent PNG.

#### Example

```html
<div class="email">
    Email Address: {{ myEmail }}
    <img v-bind:src="{{ gravatarURL(myEmail) }}" alt="User Icon" />    
</div>
```

&nbsp;

## License

Copyright © 2018 [Blobfolio, LLC](https://blobfolio.com) &lt;hello@blobfolio.com&gt;

This work is free. You can redistribute it and/or modify it under the terms of the Do What The Fuck You Want To Public License, Version 2.

    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    Version 2, December 2004
    
    Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>
    
    Everyone is permitted to copy and distribute verbatim or modified
    copies of this license document, and changing it is allowed as long
    as the name is changed.
    
    DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
    TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION
    
    0. You just DO WHAT THE FUCK YOU WANT TO.

### Donations

<table>
  <tbody>
    <tr>
      <td width="200"><img src="https://blobfolio.com/wp-content/themes/b3/svg/btc-github.svg" width="200" height="200" alt="Bitcoin QR" /></td>
      <td width="450">If you have found this work useful and would like to contribute financially, Bitcoin tips are always welcome!<br /><br /><strong>1Af56Nxauv8M1ChyQxtBe1yvdp2jtaB1GF</strong></td>
    </tr>
  </tbody>
</table>
